import { Router } from 'express'
import crypto from 'node:crypto'
import { env } from '../config.js'
import { pool } from '../db/pool.js'
import { paystackSecretKey } from '../payments/paystack.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { enqueueWebhook } from '../services/webhookQueue.js'

export const webhooksRouter = Router()

// Parse RAW body for signature verification
webhooksRouter.use((req, res, next) => {
  let data = Buffer.alloc(0)
  req.on('data', (chunk) => {
    data = Buffer.concat([data, chunk])
  })
  req.on('end', () => {
    req.rawBody = data
    next()
  })
})

async function alreadySeen(provider, eventId) {
  if (!eventId) return false
  const r = await pool.query('select 1 from webhook_events where provider = $1 and event_id = $2', [
    provider,
    eventId,
  ])
  return r.rowCount > 0
}

async function recordEvent(provider, eventId, payload) {
  await pool.query(
    `insert into webhook_events (provider, event_id, payload)
     values ($1,$2,$3)
     on conflict (provider, event_id) do nothing`,
    [provider, eventId, payload],
  )
}

function jsonFromRaw(req) {
  try {
    return JSON.parse(req.rawBody.toString('utf8'))
  } catch {
    return null
  }
}

// Paystack signature: HMAC SHA512 of raw body with secret key
webhooksRouter.post('/paystack', asyncHandler(async (req, res) => {
  const sig = req.header('x-paystack-signature')
  const secret = paystackSecretKey()
  if (!secret) return res.status(501).json({ message: 'PAYSTACK_SECRET_KEY not set' })
  if (!sig) return res.status(400).json({ message: 'Missing signature' })

  const computed = crypto
    .createHmac('sha512', secret)
    .update(req.rawBody)
    .digest('hex')

  if (computed !== sig) return res.status(401).json({ message: 'Invalid signature' })

  const payload = jsonFromRaw(req)
  if (!payload) return res.status(400).json({ message: 'Invalid JSON' })

  const eventId = payload?.data?.id ? String(payload.data.id) : payload?.event ? String(payload.event) : null
  if (eventId && (await alreadySeen('paystack', eventId))) return res.json({ ok: true, deduped: true })
  await recordEvent('paystack', eventId ?? crypto.randomUUID(), payload)

  // Map Paystack events to escrow status (foundation).
  // Common successful event: "charge.success"
  const eventName = String(payload?.event ?? '')
  const reference = payload?.data?.reference ? String(payload.data.reference) : null

  if (reference && eventName === 'charge.success') {
    const updated = await pool.query(
      `update escrow_transactions
       set status = 'held', updated_at = now(),
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('paystack_event', $2)
       where provider = 'paystack' and provider_ref = $1
       returning type, order_id, job_id`,
      [reference, payload],
    )
    const orderIds = Array.from(new Set(updated.rows.filter((r) => r.type === 'order' && r.order_id).map((r) => r.order_id)))
    if (orderIds.length) {
      await pool.query(
        `update orders
         set payment_status='paid',
             order_status = case when order_status='pending' then 'confirmed' else order_status end,
             updated_at=now()
         where id = any($1::uuid[]) and order_status <> 'cancelled'`,
        [orderIds],
      )
      // Notify farmers: order placed and paid (in-app + optional SMS)
      const { notifyWithSms } = await import('../services/messaging/index.js')
      for (const orderId of orderIds) {
        const o = await pool.query(
          `select o.id, o.buyer_id, f.user_id as farmer_user_id
           from orders o
           left join farmers f on f.id = o.farmer_id
           where o.id = $1`,
          [orderId],
        )
        const farmerUserId = o.rows[0]?.farmer_user_id ?? null
        if (farmerUserId) {
          notifyWithSms(farmerUserId, {
            type: 'order_placed',
            title: 'New order received',
            body: 'A buyer placed and paid for an order. Check your orders.',
            meta: { url: '/farmer/orders', order_id: orderId },
            dedupeKey: `order:${orderId}:placed`,
          }).catch(() => {})
        }
      }
    }
  }

  if (reference && (eventName === 'charge.failed' || eventName === 'charge.dispute.create')) {
    const nextStatus = eventName === 'charge.dispute.create' ? 'disputed' : 'failed'
    const updated = await pool.query(
      `update escrow_transactions
       set status = $2, updated_at = now(),
           meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('paystack_event', $3)
       where provider = 'paystack' and provider_ref = $1
       returning type, order_id`,
      [reference, nextStatus, payload],
    )
    if (eventName === 'charge.failed') {
      const orderIds = Array.from(new Set(updated.rows.filter((r) => r.type === 'order' && r.order_id).map((r) => r.order_id)))
      if (orderIds.length) {
        await pool.query(`update orders set payment_status='failed', updated_at=now() where id = any($1::uuid[])`, [orderIds])
      }
    }
  }

  return res.json({ ok: true })
}))

// Flutterwave signature: "verif-hash" header matches your secret hash
webhooksRouter.post('/flutterwave', asyncHandler(async (req, res) => {
  const hash = req.header('verif-hash')
  if (!env.FLUTTERWAVE_WEBHOOK_HASH) return res.status(501).json({ message: 'FLUTTERWAVE_WEBHOOK_HASH not set' })
  if (!hash) return res.status(400).json({ message: 'Missing signature' })
  if (hash !== env.FLUTTERWAVE_WEBHOOK_HASH) return res.status(401).json({ message: 'Invalid signature' })

  const payload = jsonFromRaw(req)
  if (!payload) return res.status(400).json({ message: 'Invalid JSON' })

  const eventId =
    payload?.data?.id ? String(payload.data.id) : payload?.event ? String(payload.event) : crypto.randomUUID()

  if (await alreadySeen('flutterwave', eventId)) return res.json({ ok: true, deduped: true })
  await recordEvent('flutterwave', eventId, payload)

  // Reliability: enqueue for durable processing + retries (mapping intentionally deferred).
  // This gives us a production-safe hook without implementing provider-specific logic yet.
  await enqueueWebhook({ provider: 'flutterwave', eventId, payload }).catch(() => {})
  return res.json({ ok: true, queued: true })
}))


