import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireIdVerified, requireRole } from '../middleware/auth.js'
import { env } from '../config.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { clamp01, etaMinutes, haversineKm } from '../services/algorithms.js'
import { notify } from '../services/notifications.js'
import { notifyWithSms } from '../services/messaging/index.js'
import { creditWalletTx } from '../services/walletLedger.js'

export const deliveriesRouter = Router()

const LocationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional().nullable(),
})

async function requireApprovedDriver(userId) {
  const r = await pool.query('select status, is_online, last_lat, last_lng, last_location_at from drivers where user_id = $1', [userId])
  const status = String(r.rows[0]?.status ?? '')
  if (!status) return { ok: false, message: 'Driver profile not found. Create your driver profile first.' }
  if (status !== 'approved') return { ok: false, message: 'Driver profile not approved yet. Ask an admin to approve your account.' }
  return { ok: true, driver: r.rows[0] }
}

// Driver: list deliveries available to claim (Phase 1 dispatch)
deliveriesRouter.get('/available', requireAuth, requireRole(['driver']), requireIdVerified(), asyncHandler(async (req, res) => {
  const check = await requireApprovedDriver(req.user.sub)
  if (!check.ok) return res.status(403).json({ message: check.message })
  const driver = check.driver ?? null
  if (!driver?.is_online) return res.status(403).json({ message: 'Go online to see available deliveries.' })

  const radiusKmRaw = req.query.radius_km ?? req.query.radiusKm ?? null
  const radiusKm = radiusKmRaw != null ? Number(radiusKmRaw) : null
  const radiusKmOk = radiusKm != null && Number.isFinite(radiusKm) && radiusKm > 0 ? Math.min(Math.max(radiusKm, 1), 50) : null

  const driverLat = driver?.last_lat != null ? Number(driver.last_lat) : null
  const driverLng = driver?.last_lng != null ? Number(driver.last_lng) : null
  const hasDriverGeo = Number.isFinite(driverLat) && Number.isFinite(driverLng)
  if (radiusKmOk != null && !hasDriverGeo) {
    return res.status(400).json({ message: 'Location required. Turn on location and try again.' })
  }

  const r = await pool.query(
    `select d.*,
            o.product_id,
            o.quantity,
            o.total_price,
            o.delivery_fee,
            o.delivery_address,
            p.name as product_name,
            p.category as product_category,
            f.farm_lat,
            f.farm_lng
     from deliveries d
     join orders o on o.id = d.order_id
     left join products p on p.id = o.product_id
     left join farmers f on f.id = o.farmer_id
     where d.status = 'created'
       and d.driver_user_id is null
       and o.order_status <> 'cancelled'
       and o.payment_status = 'paid'
     order by d.created_at asc
     limit 200`,
  )

  let rows = Array.isArray(r.rows) ? r.rows : []
  // Attach distance to pickup when driver has location; sort by nearest first (dispatch)
  if (hasDriverGeo) {
    rows = rows
      .map((row) => {
        const farmLat = row?.farm_lat != null ? Number(row.farm_lat) : null
        const farmLng = row?.farm_lng != null ? Number(row.farm_lng) : null
        const km = haversineKm(driverLat, driverLng, farmLat, farmLng)
        return { ...row, distance_km_to_pickup: km }
      })
      .sort((a, b) => {
        const ka = a.distance_km_to_pickup != null ? Number(a.distance_km_to_pickup) : Infinity
        const kb = b.distance_km_to_pickup != null ? Number(b.distance_km_to_pickup) : Infinity
        return ka - kb
      })
  }
  if (radiusKmOk != null && hasDriverGeo) {
    rows = rows.filter((row) => row.distance_km_to_pickup != null && row.distance_km_to_pickup <= radiusKmOk)
  }

  // Optional: text filter by area (simple, Ghana-friendly)
  const area = String(req.query.area ?? '').trim()
  if (area) {
    const q = area.toLowerCase()
    rows = rows.filter((d) => String(d.pickup_location || '').toLowerCase().includes(q) || String(d.dropoff_location || d.delivery_address || '').toLowerCase().includes(q))
  }

  return res.json(rows.slice(0, 50))
}))

// Driver: claim a delivery (assign to themselves + attach escrow fee)
deliveriesRouter.post('/:id/claim', requireAuth, requireRole(['driver']), requireIdVerified(), asyncHandler(async (req, res) => {
  const check = await requireApprovedDriver(req.user.sub)
  if (!check.ok) return res.status(403).json({ message: check.message })
  const driver = check.driver ?? null
  if (!driver?.is_online) return res.status(403).json({ message: 'Go online before claiming deliveries.' })
  // Require a recent location ping for fairness + operational quality (prevents “ghost” claims).
  const lastAt = driver?.last_location_at ? new Date(driver.last_location_at).getTime() : null
  const ageMin = lastAt != null && Number.isFinite(lastAt) ? (Date.now() - lastAt) / (60 * 1000) : null
  if (ageMin == null || ageMin > 30) {
    return res.status(403).json({ message: 'Your location is stale. Go online (GPS) again to claim deliveries.' })
  }

  const client = await pool.connect()
  try {
    await client.query('begin')

    const dRes = await client.query('select * from deliveries where id = $1 for update', [req.params.id])
    const delivery = dRes.rows[0] ?? null
    if (!delivery) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Delivery not found' })
    }
    if (delivery.status !== 'created' || delivery.driver_user_id) {
      await client.query('rollback')
      return res.status(409).json({ message: 'This delivery is not available to claim.' })
    }

    // Ensure order not cancelled
    const oRes = await client.query('select * from orders where id = $1 for update', [delivery.order_id])
    const order = oRes.rows[0] ?? null
    if (!order) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Order not found' })
    }
    if (order.order_status === 'cancelled') {
      await client.query('rollback')
      return res.status(409).json({ message: 'Order was cancelled.' })
    }
    if (order.payment_status !== 'paid') {
      await client.query('rollback')
      return res.status(409).json({ message: 'Order is not paid yet.' })
    }

    const updated = await client.query(
      `update deliveries
       set driver_user_id = $2,
           status = 'driver_assigned',
           updated_at = now()
       where id = $1
       returning *`,
      [delivery.id, req.user.sub],
    )

    // Attach the delivery escrow row to this driver so it can be released on confirm
    await client.query(
      `update escrow_transactions
       set counterparty_user_id = $2,
           updated_at = now()
       where type = 'order'
         and order_id = $1
         and (meta->>'kind') = 'delivery'`,
      [delivery.order_id, req.user.sub],
    )

    await client.query('commit')

    // Notify buyer/farmer (in-app + optional SMS)
    notifyWithSms(delivery.buyer_id ?? null, {
      type: 'driver_assigned',
      title: 'Driver assigned',
      body: 'A driver accepted your delivery request.',
      meta: { url: '/buyer/orders', delivery_id: delivery.id, order_id: delivery.order_id, status: 'driver_assigned' },
      dedupeKey: `delivery:${delivery.id}:driver_assigned`,
    }).catch(() => {})
    notifyWithSms(delivery.farmer_user_id ?? null, {
      type: 'driver_assigned',
      title: 'Driver assigned',
      body: 'A driver accepted an order delivery.',
      meta: { url: `/messages/order/${delivery.order_id}`, delivery_id: delivery.id, order_id: delivery.order_id, status: 'driver_assigned' },
      dedupeKey: `delivery:${delivery.id}:driver_assigned:farmer`,
    }).catch(() => {})

    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

deliveriesRouter.get('/me', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select d.*,
            o.product_id,
            o.quantity,
            o.total_price,
            o.delivery_fee,
            o.delivery_address,
            de.status as delivery_escrow_status,
            de.amount as delivery_escrow_amount,
            de.platform_fee as delivery_platform_fee,
            dd.id as delivery_dispute_id,
            dd.status as delivery_dispute_status,
            dd.reason as delivery_dispute_reason
     from deliveries d
     join orders o on o.id = d.order_id
     left join lateral (
       select e.id, e.status, e.amount, e.platform_fee
       from escrow_transactions e
       where e.type='order'
         and e.order_id = d.order_id
         and (e.meta->>'kind') = 'delivery'
         and (e.meta->>'delivery_id') = d.id::text
       order by e.created_at desc
       limit 1
     ) de on true
     left join lateral (
       select id, status, reason
       from disputes
       where escrow_id = de.id
         and status in ('open','under_review')
       order by created_at desc
       limit 1
     ) dd on true
     where d.driver_user_id = $1
     order by d.created_at desc`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

// Driver sends a location ping (Phase 2 tracking)
deliveriesRouter.post('/:id/location', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const parsed = LocationPingSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const dRes = await pool.query('select * from deliveries where id = $1', [req.params.id])
  const delivery = dRes.rows[0]
  if (!delivery) return res.status(404).json({ message: 'Delivery not found' })
  if (delivery.driver_user_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

  // Only while in active travel window (privacy & cost control)
  const allowed = ['driver_assigned', 'picked_up', 'on_the_way']
  if (!allowed.includes(delivery.status)) {
    return res.status(400).json({ message: `Cannot share location in status '${delivery.status}'` })
  }

  const ping = await pool.query(
    `insert into delivery_location_updates (delivery_id, driver_user_id, lat, lng, accuracy)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [delivery.id, req.user.sub, parsed.data.lat, parsed.data.lng, parsed.data.accuracy ?? null],
  )
  return res.status(201).json(ping.rows[0])
}))

// Buyer/admin (and the assigned driver) can read latest location + recent trail
deliveriesRouter.get('/:id/location', requireAuth, asyncHandler(async (req, res) => {
  const dRes = await pool.query('select * from deliveries where id = $1', [req.params.id])
  const delivery = dRes.rows[0]
  if (!delivery) return res.status(404).json({ message: 'Delivery not found' })

  const isBuyer = req.user.role === 'buyer' && delivery.buyer_id === req.user.sub
  const isDriver = req.user.role === 'driver' && delivery.driver_user_id === req.user.sub
  const isAdmin = req.user.role === 'admin'
  if (!isBuyer && !isDriver && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  const latest = await pool.query(
    `select * from delivery_location_updates
     where delivery_id = $1
     order by created_at desc
     limit 1`,
    [delivery.id],
  )
  const trail = await pool.query(
    `select lat, lng, accuracy, created_at
     from delivery_location_updates
     where delivery_id = $1
     order by created_at desc
     limit 30`,
    [delivery.id],
  )
  return res.json({ latest: latest.rows[0] ?? null, trail: trail.rows })
}))

// Buyer/admin (and assigned driver) can read deterministic delivery metrics (distance/ETA/progress).
deliveriesRouter.get('/:id/metrics', requireAuth, asyncHandler(async (req, res) => {
  const dRes = await pool.query('select * from deliveries where id = $1', [req.params.id])
  const delivery = dRes.rows[0]
  if (!delivery) return res.status(404).json({ message: 'Delivery not found' })

  const isBuyer = req.user.role === 'buyer' && delivery.buyer_id === req.user.sub
  const isFarmer = req.user.role === 'farmer' && delivery.farmer_user_id === req.user.sub
  const isDriver = req.user.role === 'driver' && delivery.driver_user_id === req.user.sub
  const isAdmin = req.user.role === 'admin'
  if (!isBuyer && !isFarmer && !isDriver && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  // Join to farmer geo (pickup) and order geo (dropoff)
  const geo = await pool.query(
    `select d.id as delivery_id,
            d.status as delivery_status,
            d.dropoff_lat, d.dropoff_lng,
            o.order_status,
            f.farm_lat, f.farm_lng,
            drv.is_online as driver_is_online,
            drv.last_location_at as driver_last_location_at
     from deliveries d
     left join orders o on o.id = d.order_id
     left join farmers f on f.id = o.farmer_id
     left join drivers drv on drv.user_id = d.driver_user_id
     where d.id = $1
     limit 1`,
    [delivery.id],
  )
  const row = geo.rows[0] ?? null

  const pickupLat = row?.farm_lat != null ? Number(row.farm_lat) : null
  const pickupLng = row?.farm_lng != null ? Number(row.farm_lng) : null
  const dropLat = row?.dropoff_lat != null ? Number(row.dropoff_lat) : null
  const dropLng = row?.dropoff_lng != null ? Number(row.dropoff_lng) : null

  const totalKm =
    pickupLat != null && pickupLng != null && dropLat != null && dropLng != null
      ? haversineKm(pickupLat, pickupLng, dropLat, dropLng)
      : null

  const etaTotal = totalKm != null ? etaMinutes(totalKm, env.DELIVERY_SPEED_KMH) : null

  // Latest driver ping (if any)
  const latest = await pool.query(
    `select lat, lng, accuracy, created_at
     from delivery_location_updates
     where delivery_id = $1
     order by created_at desc
     limit 1`,
    [delivery.id],
  )
  const latestRow = latest.rows[0] ?? null
  const latestLat = latestRow?.lat != null ? Number(latestRow.lat) : null
  const latestLng = latestRow?.lng != null ? Number(latestRow.lng) : null
  const latestAt = latestRow?.created_at ? new Date(latestRow.created_at).getTime() : null
  const latestAgeMin = latestAt != null ? (Date.now() - latestAt) / (60 * 1000) : null

  const canUseLive =
    latestLat != null &&
    latestLng != null &&
    dropLat != null &&
    dropLng != null &&
    latestAgeMin != null &&
    latestAgeMin <= 30 &&
    ['picked_up', 'on_the_way'].includes(String(delivery.status || ''))

  const remainingKm = canUseLive ? haversineKm(latestLat, latestLng, dropLat, dropLng) : null
  const etaRemaining = remainingKm != null ? etaMinutes(remainingKm, env.DELIVERY_SPEED_KMH) : null

  // Deterministic fallback progress from status when we can't compute remainingKm
  const status = String(delivery.status || 'created')
  const fallbackProgress =
    status === 'created'
      ? 0.08
      : status === 'driver_assigned'
        ? 0.18
        : status === 'picked_up'
          ? 0.45
          : status === 'on_the_way'
            ? 0.7
            : status === 'delivered'
              ? 0.92
              : status === 'confirmed'
                ? 1
                : 0.1

  const progress01 =
    totalKm != null && remainingKm != null && totalKm > 0
      ? clamp01(1 - remainingKm / totalKm)
      : clamp01(fallbackProgress)

  return res.json({
    delivery_id: delivery.id,
    delivery_status: delivery.status,
    order_status: row?.order_status ?? null,
    driver_is_online: row?.driver_is_online ?? null,
    driver_last_location_at: row?.driver_last_location_at ?? null,
    distance_km_total: totalKm != null ? Math.round(totalKm * 100) / 100 : null,
    eta_minutes_total: etaTotal,
    distance_km_remaining: remainingKm != null ? Math.round(remainingKm * 100) / 100 : null,
    eta_minutes_remaining: etaRemaining,
    using_live_location: !!canUseLive,
    last_location_at: latestRow?.created_at ?? null,
    progress01,
    speed_kmh_assumed: env.DELIVERY_SPEED_KMH,
  })
}))

async function updateStatus(deliveryId, expectedStatuses, nextStatus, userId) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const dRes = await client.query('select * from deliveries where id = $1 for update', [deliveryId])
    const delivery = dRes.rows[0]
    if (!delivery) {
      await client.query('rollback')
      return { status: 404, body: { message: 'Delivery not found' } }
    }
    if (delivery.driver_user_id !== userId) {
      await client.query('rollback')
      return { status: 403, body: { message: 'Forbidden' } }
    }
    if (!expectedStatuses.includes(delivery.status)) {
      await client.query('rollback')
      return { status: 400, body: { message: `Cannot change status from '${delivery.status}'` } }
    }
    const updated = await client.query(
      `update deliveries
       set status = $2::delivery_status,
           updated_at = now(),
           picked_up_at = case when $2::text = 'picked_up' then now() else picked_up_at end,
           on_the_way_at = case when $2::text = 'on_the_way' then now() else on_the_way_at end,
           delivered_at = case when $2::text = 'delivered' then now() else delivered_at end
       where id = $1
       returning *`,
      [deliveryId, nextStatus],
    )
    await client.query('commit')
    // Notify buyer/farmer (best-effort)
    const statusLabel =
      nextStatus === 'picked_up'
        ? 'Picked up'
        : nextStatus === 'on_the_way'
          ? 'On the way'
          : nextStatus === 'delivered'
            ? 'Delivered'
            : String(nextStatus)
    notify({
      userId: delivery.buyer_id ?? null,
      type: 'delivery_status',
      title: `Delivery update: ${statusLabel}`,
      body: 'Your delivery status changed.',
      meta: { url: '/buyer/orders', delivery_id: delivery.id, order_id: delivery.order_id, status: nextStatus },
      dedupeKey: `delivery:${delivery.id}:${nextStatus}`,
    }).catch(() => {})
    notify({
      userId: delivery.farmer_user_id ?? null,
      type: 'delivery_status',
      title: `Delivery update: ${statusLabel}`,
      body: 'An order delivery status changed.',
      meta: { url: `/messages/order/${delivery.order_id}`, delivery_id: delivery.id, order_id: delivery.order_id, status: nextStatus },
      dedupeKey: `delivery:${delivery.id}:${nextStatus}:farmer`,
    }).catch(() => {})
    return { status: 200, body: updated.rows[0] }
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}

deliveriesRouter.post('/:id/picked-up', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const r = await updateStatus(req.params.id, ['driver_assigned', 'created'], 'picked_up', req.user.sub)
  return res.status(r.status).json(r.body)
}))

deliveriesRouter.post('/:id/on-the-way', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const r = await updateStatus(req.params.id, ['picked_up'], 'on_the_way', req.user.sub)
  return res.status(r.status).json(r.body)
}))

deliveriesRouter.post('/:id/delivered', requireAuth, requireRole(['driver']), asyncHandler(async (req, res) => {
  const r = await updateStatus(req.params.id, ['on_the_way'], 'delivered', req.user.sub)
  return res.status(r.status).json(r.body)
}))

const ConfirmSchema = z.object({
  ok: z.boolean().optional().default(true),
})

// Buyer confirms delivery -> release order escrows (produce + delivery)
deliveriesRouter.post('/:id/confirm', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const parsed = ConfirmSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const dRes = await client.query('select * from deliveries where id = $1 for update', [req.params.id])
    const delivery = dRes.rows[0]
    if (!delivery) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Delivery not found' })
    }
    if (req.user.role === 'buyer' && delivery.buyer_id !== req.user.sub) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (delivery.status !== 'delivered') {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot confirm delivery in status '${delivery.status}'` })
    }

    // Lock related escrows
    const escrowsRes = await client.query(
      `select * from escrow_transactions
       where type='order' and order_id = $1
       order by created_at asc
       for update`,
      [delivery.order_id],
    )
    const escrows = escrowsRes.rows
    if (escrows.length === 0) {
      await client.query('rollback')
      return res.status(400).json({ message: 'No escrow rows found for order' })
    }

    const disputeRes = await client.query(
      `select 1
       from disputes
       where escrow_id = any($1::uuid[])
         and status in ('open','under_review')
       limit 1`,
      [escrows.map((e) => e.id)],
    )
    if (disputeRes.rowCount > 0) {
      await client.query('rollback')
      return res.status(409).json({ message: 'This order has an active dispute; delivery cannot be confirmed yet.' })
    }

    let totalPlatformFee = 0
    for (const e of escrows) {
      if (e.status !== 'held') continue
      if (!e.counterparty_user_id) continue

      const isDelivery = e.meta?.kind === 'delivery'
      const pct = isDelivery ? env.PLATFORM_FEE_PCT_DELIVERY : env.PLATFORM_FEE_PCT_ORDER
      const feePct = Math.min(Math.max(pct ?? 0, 0), 0.25)
      const platformFee = Number(e.amount) * feePct
      const payout = Number(e.amount) - platformFee
      totalPlatformFee += platformFee

      if (payout > 0) {
        await creditWalletTx(client, {
          userId: e.counterparty_user_id,
          amount: payout,
          currency: e.currency ?? 'GHS',
          kind: 'escrow_release',
          refType: 'escrow',
          refId: e.id,
          idempotencyKey: `escrow_release:${e.id}`,
          meta: { order_id: e.order_id, kind: e.meta?.kind ?? null, platform_fee: platformFee, confirmed_by: req.user.sub },
        })
      }
      await client.query(
        `update escrow_transactions
         set status='released', platform_fee=$2, updated_at=now()
         where id=$1`,
        [e.id, platformFee],
      )
    }

    await client.query(`update deliveries set status='confirmed', confirmed_at = now(), updated_at = now() where id = $1`, [
      delivery.id,
    ])
    await client.query(
      `update orders set payment_status='paid', order_status='delivered', updated_at = now() where id = $1`,
      [delivery.order_id],
    )

    await client.query('commit')
    // Notify farmer + driver that buyer confirmed (best-effort)
    notify({
      userId: delivery.farmer_user_id ?? null,
      type: 'delivery_confirmed',
      title: 'Delivery confirmed',
      body: 'Buyer confirmed delivery. Funds can now be released to sellers.',
      meta: { url: `/messages/order/${delivery.order_id}`, delivery_id: delivery.id, order_id: delivery.order_id, status: 'confirmed' },
      dedupeKey: `delivery:${delivery.id}:confirmed:farmer`,
    }).catch(() => {})
    if (delivery.driver_user_id) {
      notify({
        userId: delivery.driver_user_id,
        type: 'delivery_confirmed',
        title: 'Delivery confirmed',
        body: 'Buyer confirmed delivery. Great job.',
        meta: { url: `/driver`, delivery_id: delivery.id, order_id: delivery.order_id, status: 'confirmed' },
        dedupeKey: `delivery:${delivery.id}:confirmed:driver`,
      }).catch(() => {})
    }
    return res.json({ ok: true, platform_fee_total: totalPlatformFee })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))


