import { Router } from 'express'
import crypto from 'node:crypto'
import { env } from '../config.js'
import { pool } from '../db/pool.js'

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
webhooksRouter.post('/paystack', async (req, res) => {
  const sig = req.header('x-paystack-signature')
  if (!env.PAYSTACK_WEBHOOK_SECRET) return res.status(501).json({ message: 'PAYSTACK_WEBHOOK_SECRET not set' })
  if (!sig) return res.status(400).json({ message: 'Missing signature' })

  const computed = crypto
    .createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex')

  if (computed !== sig) return res.status(401).json({ message: 'Invalid signature' })

  const payload = jsonFromRaw(req)
  if (!payload) return res.status(400).json({ message: 'Invalid JSON' })

  const eventId = payload?.data?.id ? String(payload.data.id) : payload?.event ? String(payload.event) : null
  if (eventId && (await alreadySeen('paystack', eventId))) return res.json({ ok: true, deduped: true })
  await recordEvent('paystack', eventId ?? crypto.randomUUID(), payload)

  // TODO: map paystack events to escrow_transactions and wallet ledger once provider init flow is wired.
  return res.json({ ok: true })
})

// Flutterwave signature: "verif-hash" header matches your secret hash
webhooksRouter.post('/flutterwave', async (req, res) => {
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

  // TODO: map flutterwave events to escrow_transactions and wallet ledger once provider init flow is wired.
  return res.json({ ok: true })
})


