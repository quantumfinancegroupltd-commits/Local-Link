import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notify } from '../services/notifications.js'
import { env } from '../config.js'
import { makePaystackReference, paystackInitializeTransaction, paystackSecretKey } from '../payments/paystack.js'
import { creditWalletTx, getIdempotencyKeyFromReq } from '../services/walletLedger.js'

export const ordersRouter = Router()

const CreateSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  total_price: z.number().positive(),
  delivery_address: z.string().min(3),
  delivery_fee: z.number().nonnegative().optional().default(0),
  provider: z.enum(['paystack']).optional().default('paystack'),
  // Back-compat: older clients used delivery_*; newer clients send dropoff_*.
  delivery_place_id: z.string().optional().nullable(),
  delivery_lat: z.number().min(-90).max(90).optional().nullable(),
  delivery_lng: z.number().min(-180).max(180).optional().nullable(),
  dropoff_place_id: z.string().optional().nullable(),
  dropoff_lat: z.number().min(-90).max(90).optional().nullable(),
  dropoff_lng: z.number().min(-180).max(180).optional().nullable(),
  requested_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  occasion: z.string().max(80).optional().nullable(),
  gift_message: z.string().max(2000).optional().nullable(),
})

ordersRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  const role = req.user.role
  const userId = req.user.sub

  // buyer: own orders, farmer: orders for their products, admin: all
  let where = '1=1'
  const params = []
  if (role === 'buyer') {
    where = 'o.buyer_id = $1'
    params.push(userId)
  } else if (role === 'farmer') {
    // find farmer profile for this user
    const f = await pool.query('select id from farmers where user_id = $1', [userId])
    const farmerId = f.rows[0]?.id
    where = 'o.farmer_id = $1'
    params.push(farmerId ?? null)
  }

  // For review gating in buyer UI (null for non-buyer roles)
  const buyerReviewerId = role === 'buyer' ? userId : null
  params.push(buyerReviewerId)
  const buyerParam = `$${params.length}::uuid`

  const r = await pool.query(
    `select o.*,
            p.name as product_name,
            p.category as product_category,
            p.image_url as product_image_url,
            d.id as delivery_id,
            d.status as delivery_status,
            d.driver_user_id,
            d.pickup_location,
            d.dropoff_location,
            d.fee as delivery_task_fee,
            f.user_id as farmer_user_id,
            case when ${buyerParam} is null then null
                 when f.user_id is null then false
                 else exists(select 1 from reviews rv where rv.order_id = o.id and rv.reviewer_id = ${buyerParam} and rv.target_id = f.user_id)
            end as farmer_reviewed,
            case when ${buyerParam} is null then null
                 when d.driver_user_id is null then false
                 else exists(select 1 from reviews rv where rv.order_id = o.id and rv.reviewer_id = ${buyerParam} and rv.target_id = d.driver_user_id)
            end as driver_reviewed,
            bu.name as buyer_name,
            bu.rating as buyer_rating,
            bu.profile_pic as buyer_profile_pic,
            pe.status as produce_escrow_status,
            pe.amount as produce_escrow_amount,
            pe.platform_fee as produce_platform_fee,
            pd.status as produce_dispute_status
     from orders o
     left join products p on p.id = o.product_id
     left join farmers f on f.id = o.farmer_id
     left join deliveries d on d.order_id = o.id
     left join users bu on bu.id = o.buyer_id
     left join lateral (
       select status, amount, platform_fee
       from escrow_transactions e
       where e.type='order'
         and e.order_id = o.id
         and (e.meta->>'kind') = 'produce'
       order by e.created_at desc
       limit 1
     ) pe on true
     left join lateral (
       select d.status
       from escrow_transactions e
       join disputes d on d.escrow_id = e.id
       where e.type='order' and e.order_id = o.id and (e.meta->>'kind') = 'produce'
       order by e.created_at desc, d.created_at desc
       limit 1
     ) pd on true
     where ${where}
     order by o.created_at desc
     limit 100`,
    params,
  )

  return res.json(r.rows)
}))

ordersRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select o.*,
            p.name as product_name,
            p.category as product_category,
            p.image_url as product_image_url,
            d.id as delivery_id,
            d.status as delivery_status,
            d.driver_user_id,
            d.pickup_location,
            d.dropoff_location,
            d.fee as delivery_task_fee,
            bu.name as buyer_name,
            bu.rating as buyer_rating,
            bu.profile_pic as buyer_profile_pic,
            pe.status as produce_escrow_status,
            pe.amount as produce_escrow_amount,
            pe.platform_fee as produce_platform_fee,
            pd.status as produce_dispute_status
     from orders o
     left join products p on p.id = o.product_id
     left join deliveries d on d.order_id = o.id
     left join users bu on bu.id = o.buyer_id
     left join lateral (
       select status, amount, platform_fee
       from escrow_transactions e
       where e.type='order'
         and e.order_id = o.id
         and (e.meta->>'kind') = 'produce'
       order by e.created_at desc
       limit 1
     ) pe on true
     left join lateral (
       select d.status
       from escrow_transactions e
       join disputes d on d.escrow_id = e.id
       where e.type='order' and e.order_id = o.id and (e.meta->>'kind') = 'produce'
       order by e.created_at desc, d.created_at desc
       limit 1
     ) pd on true
     where o.id = $1`,
    [req.params.id],
  )
  const row = r.rows[0]
  if (!row) return res.status(404).json({ message: 'Order not found' })

  // Access control: buyer owns, farmer owns, assigned driver, admin.
  const role = String(req.user.role ?? '')
  const isAdmin = role === 'admin'
  const isBuyerOwner = role === 'buyer' && row.buyer_id === req.user.sub
  const isDriverAssigned = role === 'driver' && row.driver_user_id && row.driver_user_id === req.user.sub
  let isFarmerOwner = false

  if (role === 'farmer') {
    const f = await pool.query('select id from farmers where user_id = $1', [req.user.sub])
    const farmerId = f.rows[0]?.id
    if (!farmerId || row.farmer_id !== farmerId) return res.status(403).json({ message: 'Forbidden' })
    isFarmerOwner = true
  }
  if (!isAdmin && !isBuyerOwner && !isFarmerOwner && !isDriverAssigned) return res.status(403).json({ message: 'Forbidden' })

  return res.json(row)
}))

ordersRouter.post('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  // Real payments (Paystack) require server config + a buyer email.
  if (parsed.data.provider === 'paystack' && !paystackSecretKey()) {
    return res.status(501).json({ message: 'Paystack not configured (set PAYSTACK_SECRET_KEY)' })
  }
  const buyerEmailRes = await pool.query('select email from users where id = $1', [req.user.sub])
  const buyerEmail = buyerEmailRes.rows[0]?.email ?? null
  if (parsed.data.provider === 'paystack' && !buyerEmail) {
    return res.status(400).json({ message: 'Buyer email not found' })
  }

  const productRes = await pool.query(
    `select p.*, f.id as farmer_id, f.user_id as farmer_user_id
     from products p
     left join farmers f on f.id = p.farmer_id
     where p.id = $1`,
    [parsed.data.product_id],
  )
  const product = productRes.rows[0]
  if (!product) return res.status(404).json({ message: 'Product not found' })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const dropoff_place_id = parsed.data.dropoff_place_id ?? parsed.data.delivery_place_id ?? null
    const dropoff_lat = parsed.data.dropoff_lat ?? parsed.data.delivery_lat ?? null
    const dropoff_lng = parsed.data.dropoff_lng ?? parsed.data.delivery_lng ?? null

    // Note: orders table stores delivery geo as delivery_* columns (migration 025).
    // deliveries table stores dropoff_* columns for live tracking & metrics.
    const requestedDeliveryDate = parsed.data.requested_delivery_date ?? null
    const occasion = parsed.data.occasion ?? null
    const giftMessage = parsed.data.gift_message ?? null
    const r = await client.query(
      `insert into orders (
         product_id, buyer_id, farmer_id, quantity, total_price,
         delivery_address, delivery_fee,
         delivery_place_id, delivery_lat, delivery_lng,
         requested_delivery_date, occasion, gift_message,
         payment_status, order_status
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending','pending')
       returning *`,
      [
        parsed.data.product_id,
        req.user.sub,
        product.farmer_id ?? null,
        parsed.data.quantity,
        parsed.data.total_price,
        parsed.data.delivery_address,
        parsed.data.delivery_fee ?? 0,
        dropoff_place_id,
        dropoff_lat,
        dropoff_lng,
        requestedDeliveryDate,
        occasion,
        giftMessage,
      ],
    )
    const order = r.rows[0]

    // Create delivery task (status-based, no maps yet)
    const delivery = await client.query(
      `insert into deliveries (order_id, buyer_id, farmer_user_id, pickup_location, dropoff_location, dropoff_place_id, dropoff_lat, dropoff_lng, fee, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'created')
       returning *`,
      [
        order.id,
        req.user.sub,
        product.farmer_user_id ?? null,
        product.farm_location ?? null,
        parsed.data.delivery_address,
        dropoff_place_id,
        dropoff_lat,
        dropoff_lng,
        parsed.data.delivery_fee ?? 0,
      ],
    )

    // Create escrow rows: produce portion (farmer) + delivery portion (driver later).
    // IMPORTANT: For real payments, these start as pending_payment and become held only after Paystack confirms.
    const reference = makePaystackReference(`ll_order_${order.id}`)
    await client.query(
      `insert into escrow_transactions (type, buyer_id, counterparty_user_id, order_id, amount, status, provider, provider_ref, meta)
       values ('order',$1,$2,$3,$4,'pending_payment','paystack',$5, jsonb_build_object('kind','produce','payment_group',$5))`,
      [req.user.sub, product.farmer_user_id ?? null, order.id, parsed.data.total_price, reference],
    )
    await client.query(
      `insert into escrow_transactions (type, buyer_id, counterparty_user_id, order_id, amount, status, provider, provider_ref, meta)
       values ('order',$1,null,$2,$3,'pending_payment','paystack',$4, jsonb_build_object('kind','delivery','delivery_id',$5::text,'payment_group',$4))`,
      [req.user.sub, order.id, parsed.data.delivery_fee ?? 0, reference, delivery.rows[0].id],
    )

    await client.query('commit')

    // Initialize Paystack and return redirect URL
    const callbackUrl = env.APP_BASE_URL
      ? `${env.APP_BASE_URL.replace(/\/$/, '')}/buyer/payments/paystack?reference=${encodeURIComponent(reference)}&orderId=${encodeURIComponent(order.id)}`
      : undefined

    try {
      const init = await paystackInitializeTransaction({
        email: buyerEmail,
        amountGhs: Number(parsed.data.total_price) + Number(parsed.data.delivery_fee ?? 0),
        reference,
        metadata: {
          type: 'order',
          order_id: order.id,
          buyer_id: req.user.sub,
          delivery_id: delivery.rows[0]?.id ?? null,
        },
        callbackUrl,
      })
      return res.status(201).json({
        order,
        delivery: delivery.rows[0],
        provider: 'paystack',
        provider_ref: reference,
        paystack: {
          authorization_url: init?.data?.authorization_url,
          access_code: init?.data?.access_code,
          reference: init?.data?.reference,
        },
      })
    } catch (e) {
      // Mark payment failed for visibility; user can retry via /orders/:id/pay
      await pool.query(`update orders set payment_status='failed', updated_at=now() where id=$1`, [order.id])
      await pool.query(
        `update escrow_transactions set status='failed', updated_at=now(),
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('paystack_init_error', $2)
         where type='order' and order_id=$1 and provider='paystack' and provider_ref=$3`,
        [order.id, { message: e?.message, code: e?.code }, reference],
      )
      return res.status(502).json({ message: e?.message || 'Paystack initialize failed', code: e?.code, order_id: order.id })
    }
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// Buyer: retry Paystack payment for an existing order (before pickup)
ordersRouter.post('/:id/pay', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  if (!paystackSecretKey()) return res.status(501).json({ message: 'Paystack not configured (set PAYSTACK_SECRET_KEY)' })
  const client = await pool.connect()
  let order = null
  let delivery = null
  let buyerEmail = null
  let reference = null
  try {
    await client.query('begin')

    const orderRes = await client.query('select * from orders where id = $1 for update', [req.params.id])
    order = orderRes.rows[0] ?? null
    if (!order) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Order not found' })
    }
    if (req.user.role === 'buyer' && order.buyer_id !== req.user.sub) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (order.order_status === 'cancelled') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Order is cancelled.' })
    }
    if (order.payment_status === 'paid') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Order is already paid.' })
    }

    const deliveryRes = await client.query('select * from deliveries where order_id = $1 for update', [order.id])
    delivery = deliveryRes.rows[0] ?? null
    if (delivery && ['picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(String(delivery.status))) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Cannot pay after pickup has started. Use dispute if needed.' })
    }

    const buyerEmailRes = await client.query('select email from users where id = $1', [order.buyer_id])
    buyerEmail = buyerEmailRes.rows[0]?.email ?? null
    if (!buyerEmail) {
      await client.query('rollback')
      return res.status(400).json({ message: 'Buyer email not found' })
    }

    const escrowsRes = await client.query(
      `select *
       from escrow_transactions
       where type='order' and order_id = $1 and provider = 'paystack'
       order by created_at asc
       for update`,
      [order.id],
    )
    const escrows = escrowsRes.rows ?? []

    // If a pending_payment group already exists, reuse it (avoids orphaning an in-flight Paystack session).
    const pending = [...escrows].reverse().find((e) => String(e.status) === 'pending_payment' && e.provider_ref)
    if (pending?.provider_ref) {
      reference = String(pending.provider_ref)
    } else {
      // Optional idempotency: if the client retries the same request, keep the same reference.
      const idemRaw = getIdempotencyKeyFromReq(req)
      const idemBase = idemRaw ? `escrow_pay_order:${order.id}:${idemRaw}` : null
      if (idemBase) {
        const ex = await client.query(
          `select provider_ref
           from escrow_transactions
           where buyer_id = $1 and idempotency_key = any($2::text[])
             and provider_ref is not null
           order by created_at desc
           limit 1`,
          [order.buyer_id, [`${idemBase}:produce`, `${idemBase}:delivery`]],
        )
        if (ex.rows[0]?.provider_ref) reference = String(ex.rows[0].provider_ref)
      }
      if (!reference) reference = makePaystackReference(`ll_order_${order.id}`)

      if (escrows.length === 0) {
        // Ensure farmer user for escrow counterparty (produce portion)
        const farmerUserRes = await client.query(
          `select f.user_id
           from farmers f
           where f.id = $1
           limit 1`,
          [order.farmer_id],
        )
        const farmerUserId = farmerUserRes.rows[0]?.user_id ?? null

        await client.query(
          `insert into escrow_transactions (type, buyer_id, counterparty_user_id, order_id, amount, status, provider, provider_ref, idempotency_key, meta)
           values ('order',$1,$2,$3,$4,'pending_payment','paystack',$5,$6, jsonb_build_object('kind','produce','payment_group',$5,'retry',true))`,
          [order.buyer_id, farmerUserId, order.id, Number(order.total_price ?? 0), reference, idemBase ? `${idemBase}:produce` : null],
        )
        await client.query(
          `insert into escrow_transactions (type, buyer_id, counterparty_user_id, order_id, amount, status, provider, provider_ref, idempotency_key, meta)
           values ('order',$1,null,$2,$3,'pending_payment','paystack',$4,$5, jsonb_build_object('kind','delivery','delivery_id',$6::text,'payment_group',$4,'retry',true))`,
          [order.buyer_id, order.id, Number(order.delivery_fee ?? 0), reference, idemBase ? `${idemBase}:delivery` : null, delivery?.id ?? null],
        )
      } else {
        // Only reset FAILED/CANCELLED escrows to pending_payment.
        // Do NOT overwrite provider_ref on pending_payment rows (prevents orphaned Paystack transactions).
        await client.query(
          `update escrow_transactions
           set status='pending_payment',
               provider='paystack',
               provider_ref=$2,
               updated_at=now(),
               meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('payment_group', $2, 'retry', true)
           where type='order' and order_id=$1 and status in ('failed','cancelled')`,
          [order.id, reference],
        )
      }
    }

    await client.query(`update orders set payment_status='pending', updated_at=now() where id=$1`, [order.id])
    await client.query('commit')
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }

  const callbackUrl = env.APP_BASE_URL
    ? `${env.APP_BASE_URL.replace(/\/$/, '')}/buyer/payments/paystack?reference=${encodeURIComponent(reference)}&orderId=${encodeURIComponent(order.id)}`
    : undefined

  const init = await paystackInitializeTransaction({
    email: buyerEmail,
    amountGhs: Number(order.total_price ?? 0) + Number(order.delivery_fee ?? 0),
    reference,
    metadata: { type: 'order', order_id: order.id, buyer_id: order.buyer_id, delivery_id: delivery?.id ?? null, retry: true },
    callbackUrl,
  })

  return res.json({
    ok: true,
    order_id: order.id,
    provider_ref: reference,
    paystack: {
      authorization_url: init?.data?.authorization_url,
      access_code: init?.data?.access_code,
      reference: init?.data?.reference,
    },
  })
}))

// Buyer/admin cancels an order BEFORE pickup (refunds escrow rows back to buyer wallet).
ordersRouter.post('/:id/cancel', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')

    const oRes = await client.query('select * from orders where id = $1 for update', [req.params.id])
    const order = oRes.rows[0]
    if (!order) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Order not found' })
    }
    if (req.user.role === 'buyer' && order.buyer_id !== req.user.sub) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (order.order_status === 'cancelled') {
      await client.query('rollback')
      return res.json({ ok: true, message: 'Order already cancelled.' })
    }
    if (order.order_status === 'delivered') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Cannot cancel an order that is already delivered. Use dispute instead.' })
    }

    const dRes = await client.query('select * from deliveries where order_id = $1 for update', [order.id])
    const delivery = dRes.rows[0] ?? null
    if (delivery && ['picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(delivery.status)) {
      await client.query('rollback')
      return res.status(409).json({ message: 'Order is already in delivery. Use dispute instead of cancellation.' })
    }

    const escrowsRes = await client.query(
      `select * from escrow_transactions
       where type='order' and order_id = $1
       order by created_at asc
       for update`,
      [order.id],
    )
    const escrows = escrowsRes.rows

    if (escrows.length) {
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
        return res.status(409).json({ message: 'This order has an active dispute; it cannot be cancelled.' })
      }
    }

    const refundable = escrows.filter((e) => e.status === 'held' && e.buyer_id)
    const refundAmount = refundable.reduce((sum, e) => sum + Number(e.amount ?? 0), 0)

    for (const e of refundable) {
      const amt = Number(e.amount ?? 0)
      if (amt <= 0) continue
      await creditWalletTx(client, {
        userId: e.buyer_id,
        amount: amt,
        currency: e.currency ?? 'GHS',
        kind: 'escrow_refund',
        refType: 'escrow',
        refId: e.id,
        idempotencyKey: `escrow_refund:${e.id}`,
        meta: { order_id: order.id, cancelled_by: req.user.sub, kind: e.meta?.kind ?? null },
      })
    }

    if (escrows.length) {
      await client.query(
        `update escrow_transactions
         set status = case
           when status = 'held' then 'refunded'
           when status in ('pending_payment','failed') then 'cancelled'
           else status
         end,
         updated_at = now(),
         meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('cancelled_by', $2::text)
         where id = any($1::uuid[])`,
        [escrows.map((e) => e.id), req.user.sub],
      )
    }

    if (delivery) {
      await client.query(`update deliveries set status='cancelled', updated_at = now() where id = $1`, [delivery.id])
    }
    await client.query(`update orders set order_status='cancelled', updated_at = now() where id = $1`, [order.id])

    await client.query('commit')

    // Notify farmer/driver (best-effort)
    const farmerUserRes = await pool.query('select user_id from farmers where id = $1', [order.farmer_id])
    const farmerUserId = farmerUserRes.rows[0]?.user_id ?? null
    notify({
      userId: farmerUserId,
      type: 'order_cancelled',
      title: 'Order cancelled',
      body: 'A buyer cancelled an order.',
      meta: { url: `/messages/order/${order.id}`, order_id: order.id },
      dedupeKey: `order:${order.id}:cancelled`,
    }).catch(() => {})
    if (delivery?.driver_user_id) {
      notify({
        userId: delivery.driver_user_id,
        type: 'delivery_cancelled',
        title: 'Delivery cancelled',
        body: 'A buyer cancelled an order delivery.',
        meta: { url: `/driver`, order_id: order.id, delivery_id: delivery.id },
        dedupeKey: `delivery:${delivery.id}:cancelled`,
      }).catch(() => {})
    }

    return res.json({ ok: true, refunded_amount: refundAmount })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))


