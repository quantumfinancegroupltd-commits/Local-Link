import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { env } from '../config.js'
import { makePaystackReference, paystackInitializeTransaction, paystackVerifyTransaction } from '../payments/paystack.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { creditWalletTx, getIdempotencyKeyFromReq } from '../services/walletLedger.js'

export const escrowRouter = Router()

// --- Job escrow ---
escrowRouter.get('/jobs/:jobId', requireAuth, asyncHandler(async (req, res) => {
  const jobRes = await pool.query('select id, buyer_id, assigned_artisan_id, deleted_at from jobs where id = $1', [req.params.jobId])
  const job = jobRes.rows[0] ?? null
  if (!job || job.deleted_at) return res.status(404).json({ message: 'Job not found' })

  let artisanUserId = null
  if (job.assigned_artisan_id) {
    const a = await pool.query(
      `select u.id as user_id
       from artisans ar
       join users u on u.id = ar.user_id
       where ar.id = $1
       limit 1`,
      [job.assigned_artisan_id],
    )
    artisanUserId = a.rows[0]?.user_id ?? null
  }

  const isAdmin = req.user.role === 'admin'
  const isBuyer = job.buyer_id && job.buyer_id === req.user.sub
  const isArtisanParty = artisanUserId && artisanUserId === req.user.sub
  if (!isAdmin && !isBuyer && !isArtisanParty) return res.status(403).json({ message: 'Forbidden' })

  const r = await pool.query(
    `select e.*,
       (select json_build_object('id', d.id, 'status', d.status)
        from disputes d
        where d.escrow_id = e.id
        order by case d.status when 'open' then 1 when 'under_review' then 2 else 3 end,
                 d.created_at desc
        limit 1) as dispute
     from escrow_transactions e
     where e.type = 'job' and e.job_id = $1
     order by e.created_at desc`,
    [req.params.jobId],
  )
  const rows = r.rows.map((row) => {
    const { dispute, ...rest } = row
    return { ...rest, dispute: dispute && dispute.id ? dispute : null }
  })
  return res.json(rows)
}))

const DisputeEvidenceSchema = z
  .object({
    files: z.array(z.string().min(1)).max(12).optional(),
    note: z.string().max(2000).optional().nullable(),
  })
  .passthrough()
  .optional()
  .nullable()

const DisputeSchema = z.object({
  reason: z.enum([
    'work_not_completed',
    'poor_quality',
    'late_delivery',
    'wrong_item',
    'communication_issue',
    'other',
  ]),
  details: z.string().optional().nullable(),
  evidence: DisputeEvidenceSchema,
})

// Buyer or seller can raise a dispute for the latest job escrow (before release)
escrowRouter.post('/jobs/:jobId/dispute', requireAuth, asyncHandler(async (req, res) => {
  const parsed = DisputeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const eRes = await client.query(
      `select *
       from escrow_transactions
       where type='job' and job_id = $1
       order by created_at desc
       limit 1
       for update`,
      [req.params.jobId],
    )
    const escrow = eRes.rows[0]
    if (!escrow) {
      await client.query('rollback')
      return res.status(404).json({ message: 'No escrow transaction found' })
    }
    const isParty = escrow.buyer_id === req.user.sub || escrow.counterparty_user_id === req.user.sub
    if (!isParty && req.user.role !== 'admin') {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (escrow.status === 'released' || escrow.status === 'refunded') {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot dispute escrow in status '${escrow.status}'` })
    }

    // Attach proof-of-work (before/after) automatically for faster resolution.
    const proofRes = await client.query(
      `select kind, note, media, created_at
       from job_proofs
       where job_id = $1
       order by created_at asc
       limit 20`,
      [escrow.job_id],
    )
    const proofs = (proofRes.rows || []).map((p) => ({
      kind: p.kind,
      note: p.note,
      media: Array.isArray(p.media) ? p.media : p.media ?? null,
      created_at: p.created_at,
    }))
    const mergedEvidence =
      parsed.data.evidence && typeof parsed.data.evidence === 'object'
        ? { ...parsed.data.evidence, job_proof: proofs }
        : { job_proof: proofs }

    // We enforce only one ACTIVE dispute via a partial unique index; can't use ON CONFLICT here.
    // Instead: update active dispute if present, else insert a new one.
    const active = await client.query(
      `select *
       from disputes
       where escrow_id = $1 and status in ('open','under_review')
       order by created_at desc
       limit 1
       for update`,
      [escrow.id],
    )

    let d
    if (active.rows[0]) {
      d = await client.query(
        `update disputes
         set reason = $2,
             details = $3,
             evidence = $4,
             updated_at = now()
         where id = $1
         returning *`,
        [active.rows[0].id, parsed.data.reason, parsed.data.details ?? null, mergedEvidence],
      )
    } else {
      d = await client.query(
        `insert into disputes (escrow_id, raised_by_user_id, reason, details, evidence, status)
         values ($1,$2,$3,$4,$5,'open')
         returning *`,
        [escrow.id, req.user.sub, parsed.data.reason, parsed.data.details ?? null, mergedEvidence],
      )
    }

    await client.query(`update escrow_transactions set status='disputed', updated_at = now() where id = $1`, [escrow.id])

    await client.query('commit')

    // Notify admins: dispute opened
    const { notifyWithSms } = await import('../services/messaging/index.js')
    const admins = await pool.query(`select id from users where role='admin' and deleted_at is null`)
    for (const a of admins.rows ?? []) {
      if (a?.id) {
        notifyWithSms(a.id, {
          type: 'dispute_opened',
          title: 'Dispute opened',
          body: `A dispute was opened on a job escrow. Review in Admin.`,
          meta: { url: '/admin', escrow_id: escrow.id, job_id: escrow.job_id },
          dedupeKey: `dispute:job:${escrow.job_id}`,
        }).catch(() => {})
      }
    }

    return res.status(201).json(d.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      // ignore
    }
    throw e
  } finally {
    client.release()
  }
}))

const OrderDisputeSchema = DisputeSchema.extend({
  scope: z.enum(['order', 'produce', 'delivery']).optional().default('order'),
})

// Buyer/farmer/driver can raise a dispute for an order. (We attach the dispute to one escrow row, but can freeze multiple.)
escrowRouter.post('/orders/:orderId/dispute', requireAuth, asyncHandler(async (req, res) => {
  const parsed = OrderDisputeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const orderRes = await client.query('select * from orders where id = $1 for update', [req.params.orderId])
    const order = orderRes.rows[0]
    if (!order) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Order not found' })
    }

    const deliveryRes = await client.query('select * from deliveries where order_id = $1 for update', [order.id])
    const delivery = deliveryRes.rows[0] ?? null

    const escrowsRes = await client.query(
      `select *
       from escrow_transactions
       where type='order' and order_id = $1
       order by created_at asc
       for update`,
      [order.id],
    )
    const escrows = escrowsRes.rows
    if (escrows.length === 0) {
      await client.query('rollback')
      return res.status(404).json({ message: 'No escrow rows found for order' })
    }

    const buyerId = escrows[0]?.buyer_id ?? null
    const produceEscrow = escrows.find((e) => e.meta?.kind === 'produce') ?? escrows.find((e) => e.meta?.kind !== 'delivery') ?? escrows[0]
    const deliveryEscrow = escrows.find((e) => e.meta?.kind === 'delivery') ?? null

    const farmerUserId = produceEscrow?.counterparty_user_id ?? null
    const driverUserId = delivery?.driver_user_id ?? null

    const isParty =
      (buyerId && buyerId === req.user.sub) ||
      (farmerUserId && farmerUserId === req.user.sub) ||
      (driverUserId && driverUserId === req.user.sub)

    if (!isParty && req.user.role !== 'admin') {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }

    let affected = []
    if (parsed.data.scope === 'produce') affected = produceEscrow ? [produceEscrow] : []
    else if (parsed.data.scope === 'delivery') affected = deliveryEscrow ? [deliveryEscrow] : []
    else affected = escrows

    if (affected.length === 0) {
      await client.query('rollback')
      return res.status(400).json({ message: 'No applicable escrow row to dispute yet.' })
    }

    for (const e of affected) {
      if (e.status === 'released' || e.status === 'refunded') {
        await client.query('rollback')
        return res.status(400).json({ message: `Cannot dispute escrow in status '${e.status}'` })
      }
    }

    const primaryEscrow = affected[0]

    const active = await client.query(
      `select *
       from disputes
       where escrow_id = $1 and status in ('open','under_review')
       order by created_at desc
       limit 1
       for update`,
      [primaryEscrow.id],
    )

    const evidence = parsed.data.evidence ?? null
    const evidenceWithScope =
      evidence && typeof evidence === 'object'
        ? { ...evidence, scope: parsed.data.scope, affected_escrow_ids: affected.map((x) => x.id) }
        : { scope: parsed.data.scope, affected_escrow_ids: affected.map((x) => x.id) }

    let d
    if (active.rows[0]) {
      d = await client.query(
        `update disputes
         set reason = $2,
             details = $3,
             evidence = $4,
             updated_at = now()
         where id = $1
         returning *`,
        [active.rows[0].id, parsed.data.reason, parsed.data.details ?? null, evidenceWithScope],
      )
    } else {
      d = await client.query(
        `insert into disputes (escrow_id, raised_by_user_id, reason, details, evidence, status)
         values ($1,$2,$3,$4,$5,'open')
         returning *`,
        [primaryEscrow.id, req.user.sub, parsed.data.reason, parsed.data.details ?? null, evidenceWithScope],
      )
    }

    await client.query(
      `update escrow_transactions
       set status='disputed', updated_at = now()
       where id = any($1::uuid[])`,
      [affected.map((x) => x.id)],
    )

    await client.query('commit')

    // Notify admins: order dispute opened
    const { notifyWithSms } = await import('../services/messaging/index.js')
    const admins = await pool.query(`select id from users where role='admin' and deleted_at is null`)
    for (const a of admins.rows ?? []) {
      if (a?.id) {
        notifyWithSms(a.id, {
          type: 'dispute_opened',
          title: 'Order dispute opened',
          body: `A dispute was opened on an order. Review in Admin.`,
          meta: { url: '/admin', order_id: order.id },
          dedupeKey: `dispute:order:${order.id}`,
        }).catch(() => {})
      }
    }

    return res.status(201).json(d.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// List disputes relevant to the current user
escrowRouter.get('/disputes', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select d.*,
            e.type as escrow_type,
            e.amount as escrow_amount,
            e.currency as escrow_currency,
            e.status as escrow_status,
            e.job_id,
            e.order_id,
            e.buyer_id,
            e.counterparty_user_id
     from disputes d
     join escrow_transactions e on e.id = d.escrow_id
     where d.raised_by_user_id = $1
        or e.buyer_id = $1
        or e.counterparty_user_id = $1
     order by d.created_at desc
     limit 50`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

const DepositSchema = z.object({
  amount: z.number().positive(),
  provider: z.enum(['paystack', 'flutterwave']).optional(),
})

escrowRouter.post('/jobs/:jobId/deposit', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const parsed = DepositSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const idemRaw = getIdempotencyKeyFromReq(req)
  const idem = idemRaw ? `escrow_deposit_job:${idemRaw}` : null

  const jobRes = await pool.query('select * from jobs where id = $1', [req.params.jobId])
  const job = jobRes.rows[0]
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })

  if (idem) {
    const existing = await pool.query(
      `select *
       from escrow_transactions
       where buyer_id = $1 and idempotency_key = $2
       order by created_at desc
       limit 1`,
      [req.user.sub, idem],
    )
    if (existing.rows[0]) return res.status(200).json(existing.rows[0])
  }

  // Avoid accidental duplicate intents on refresh/retry when there's already an active escrow row.
  const active = await pool.query(
    `select *
     from escrow_transactions
     where type='job' and job_id = $1
       and status in ('pending_payment','held','completed_pending_confirmation','disputed')
     order by created_at desc
     limit 1`,
    [job.id],
  )
  const activeEscrow = active.rows[0] ?? null
  if (activeEscrow) {
    if (String(activeEscrow.status) === 'pending_payment') return res.status(200).json(activeEscrow)
    return res.status(409).json({ message: `Escrow already active in status '${activeEscrow.status}'`, escrow: activeEscrow })
  }

  // Resolve artisan user as counterparty (if assigned)
  let counterpartyUserId = null
  if (job.assigned_artisan_id) {
    const a = await pool.query(
      `select u.id as user_id
       from artisans ar
       join users u on u.id = ar.user_id
       where ar.id = $1`,
      [job.assigned_artisan_id],
    )
    counterpartyUserId = a.rows[0]?.user_id ?? null
  }

  const r = await pool.query(
    `insert into escrow_transactions (type, buyer_id, counterparty_user_id, job_id, amount, status, provider, idempotency_key)
     values ('job', $1, $2, $3, $4, 'pending_payment', $5, $6)
     returning *`,
    [req.user.sub, counterpartyUserId, job.id, parsed.data.amount, parsed.data.provider ?? null, idem],
  )

  const escrow = r.rows[0]

  // If Paystack is requested and configured, initialize a payment and return the authorization URL.
  if ((parsed.data.provider ?? null) === 'paystack') {
    // Fetch buyer email for Paystack requirement
    const buyerRes = await pool.query('select email from users where id = $1', [req.user.sub])
    const buyerEmail = buyerRes.rows[0]?.email
    if (!buyerEmail) return res.status(400).json({ message: 'Buyer email not found' })

    const reference = makePaystackReference(`ll_job_${job.id}`)
    await pool.query('update escrow_transactions set provider_ref = $1, updated_at = now() where id = $2', [
      reference,
      escrow.id,
    ])

    try {
      const callbackUrl = env.APP_BASE_URL
        ? `${env.APP_BASE_URL.replace(/\/$/, '')}/buyer/payments/paystack?reference=${encodeURIComponent(reference)}&jobId=${encodeURIComponent(job.id)}`
        : undefined

      const init = await paystackInitializeTransaction({
        email: buyerEmail,
        amountGhs: parsed.data.amount,
        reference,
        metadata: {
          escrow_id: escrow.id,
          job_id: job.id,
          buyer_id: req.user.sub,
          type: 'job',
        },
        callbackUrl,
      })

      return res.status(201).json({
        ...escrow,
        provider_ref: reference,
        paystack: {
          authorization_url: init?.data?.authorization_url,
          access_code: init?.data?.access_code,
          reference: init?.data?.reference,
        },
      })
    } catch (e) {
      if (e?.code === 'PAYSTACK_NOT_CONFIGURED') {
        return res.status(501).json({
          message: 'Paystack not configured (set PAYSTACK_SECRET_KEY)',
          escrow,
        })
      }
      return res.status(502).json({
        message: e?.message || 'Paystack initialize failed',
        code: e?.code,
        escrow,
      })
    }
  }

  // Otherwise: create escrow intent only.
  return res.status(201).json(escrow)
}))

// Verify Paystack transaction server-side and update escrow status (for immediate UI confirmation)
escrowRouter.get('/paystack/verify/:reference', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const reference = req.params.reference
  const escrowRes = await pool.query(
    `select * from escrow_transactions where provider = 'paystack' and provider_ref = $1 order by created_at desc`,
    [reference],
  )
  const escrows = escrowRes.rows ?? []
  if (escrows.length === 0) return res.status(404).json({ message: 'Escrow transaction not found' })

  // Buyers should only see their own escrows (even if they guess a reference).
  const visible = req.user.role === 'buyer' ? escrows.filter((e) => e.buyer_id === req.user.sub) : escrows
  if (req.user.role === 'buyer' && visible.length === 0) return res.status(403).json({ message: 'Forbidden' })

  try {
    const verified = await paystackVerifyTransaction(reference)
    const status = String(verified?.data?.status ?? '')
    const success = status === 'success'

    const nextStatus = success ? 'held' : 'failed'
    const updated = await pool.query(
      `update escrow_transactions
       set status = $2, updated_at = now(),
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('paystack_verify', $3)
       where provider = 'paystack' and provider_ref = $1
       returning *`,
      [reference, nextStatus, verified],
    )

    // If this reference maps to an order payment group, update order payment_status accordingly.
    const orderIds = Array.from(new Set(updated.rows.filter((e) => e.type === 'order' && e.order_id).map((e) => e.order_id)))
    if (orderIds.length) {
      await pool.query(
        `update orders
         set payment_status = $2,
             order_status = case when $2 = 'paid' and order_status='pending' then 'confirmed' else order_status end,
             updated_at = now()
         where id = any($1::uuid[])`,
        [orderIds, success ? 'paid' : 'failed'],
      )
    }

    const updatedVisible = req.user.role === 'buyer' ? updated.rows.filter((e) => e.buyer_id === req.user.sub) : updated.rows
    return res.json({ ok: true, escrows: updatedVisible, paystack: verified })
  } catch (e) {
    if (e?.code === 'PAYSTACK_NOT_CONFIGURED') return res.status(501).json({ message: 'Paystack not configured' })
    return res.status(502).json({ message: e?.message || 'Paystack verify failed', code: e?.code })
  }
}))

// Placeholder "release" (admin or buyer confirmation flow comes next)
escrowRouter.post('/jobs/:jobId/release', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')

    const escrowRes = await client.query(
      `select *
       from escrow_transactions
       where type='job' and job_id = $1
       order by created_at desc
       limit 1
       for update`,
      [req.params.jobId],
    )
    const escrow = escrowRes.rows[0]
    if (!escrow) {
      await client.query('rollback')
      return res.status(404).json({ message: 'No escrow transaction found' })
    }
    if (String(escrow.status) === 'released') {
      await client.query('commit')
      return res.json(escrow)
    }
    if (!['held', 'completed_pending_confirmation'].includes(escrow.status)) {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot release escrow in status '${escrow.status}'` })
    }

    const disputeRes = await client.query(
      `select 1
       from disputes
       where escrow_id = $1
         and status in ('open','under_review')
       limit 1`,
      [escrow.id],
    )
    if (disputeRes.rowCount > 0) {
      await client.query('rollback')
      return res.status(409).json({ message: 'This escrow has an active dispute; it cannot be released yet.' })
    }

    // If buyer is releasing, require job completion (prevents abuse).
    if (req.user.role === 'buyer') {
      const jobRes = await client.query('select * from jobs where id = $1', [req.params.jobId])
      const job = jobRes.rows[0]
      if (!job) {
        await client.query('rollback')
        return res.status(404).json({ message: 'Job not found' })
      }
      if (job.buyer_id !== req.user.sub) {
        await client.query('rollback')
        return res.status(403).json({ message: 'Forbidden' })
      }
      if (job.status !== 'completed' && escrow.status !== 'completed_pending_confirmation') {
        await client.query('rollback')
        return res.status(400).json({ message: 'Job is not marked completed yet' })
      }
      await client.query('update jobs set buyer_confirmed_at = now(), updated_at = now() where id = $1', [job.id])
    }

    const feePct = Math.min(Math.max(env.PLATFORM_FEE_PCT_JOB ?? 0, 0), 0.25)
    const platformFee = Number(escrow.amount) * feePct
    const payout = Number(escrow.amount) - platformFee

    // Credit provider wallet (atomic + ledgered)
    if (escrow.counterparty_user_id && payout > 0) {
      await creditWalletTx(client, {
        userId: escrow.counterparty_user_id,
        amount: payout,
        currency: escrow.currency ?? 'GHS',
        kind: 'escrow_release',
        refType: 'escrow',
        refId: escrow.id,
        idempotencyKey: `escrow_release:${escrow.id}`,
        meta: { type: 'job', job_id: escrow.job_id, platform_fee: platformFee, gross_amount: Number(escrow.amount) },
      })
    }

    const updated = await client.query(
      `update escrow_transactions
       set status = 'released',
           platform_fee = $2,
           updated_at = now()
       where id = $1
       returning *`,
      [escrow.id, platformFee],
    )

    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      // ignore
    }
    throw e
  } finally {
    client.release()
  }
}))


