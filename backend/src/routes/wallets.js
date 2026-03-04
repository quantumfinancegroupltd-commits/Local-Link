import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth, requireIdVerified } from '../middleware/auth.js'
import { z } from 'zod'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { debitWalletTx, getIdempotencyKeyFromReq } from '../services/walletLedger.js'

export const walletsRouter = Router()

async function getOrCreateWallet(userId) {
  const r = await pool.query('select * from wallets where user_id = $1', [userId])
  if (r.rows[0]) return r.rows[0]
  const created = await pool.query(
    `insert into wallets (user_id, balance, currency)
     values ($1, 0, 'GHS')
     returning *`,
    [userId],
  )
  return created.rows[0]
}

walletsRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user.sub)
  return res.json(wallet)
}))

// Seller/business dashboard summary
walletsRouter.get('/summary', requireAuth, asyncHandler(async (req, res) => {
  const wallet = await getOrCreateWallet(req.user.sub)

  const pending = await pool.query(
    `select coalesce(sum(amount - coalesce(platform_fee,0)), 0) as total
     from escrow_transactions
     where counterparty_user_id = $1
       and status in ('pending_payment','held','disputed')`,
    [req.user.sub],
  )

  const completed = await pool.query(
    `select coalesce(sum(amount - coalesce(platform_fee,0)), 0) as total
     from escrow_transactions
     where counterparty_user_id = $1
       and status = 'released'
       and date_trunc('month', updated_at) = date_trunc('month', now())`,
    [req.user.sub],
  )

  return res.json({
    available_balance: Number(wallet.balance ?? 0),
    pending_escrow: Number(pending.rows[0]?.total ?? 0),
    completed_this_month: Number(completed.rows[0]?.total ?? 0),
    currency: wallet.currency ?? 'GHS',
  })
}))

// Time-series for dashboard charts: earnings and jobs released by day (artisan/farmer/driver)
walletsRouter.get('/analytics', requireAuth, asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const userId = req.user.sub

  const [earningsByDay, jobsByDay] = await Promise.all([
    pool.query(
      `select date_trunc('day', created_at at time zone 'UTC')::date as day, coalesce(sum(amount), 0)::numeric(12,2) as amount
       from wallet_ledger_entries
       where user_id = $1 and direction = 'credit' and kind = 'escrow_release' and created_at >= $2
       group by 1 order by 1`,
      [userId, since],
    ),
    pool.query(
      `select date_trunc('day', updated_at at time zone 'UTC')::date as day, count(*)::int as count
       from escrow_transactions
       where counterparty_user_id = $1 and status = 'released' and updated_at >= $2
       group by 1 order by 1`,
      [userId, since],
    ),
  ])

  const dayMap = {}
  for (let d = 0; d < days; d++) {
    const t = new Date(since)
    t.setUTCDate(t.getUTCDate() + d)
    const key = t.toISOString().slice(0, 10)
    dayMap[key] = { day: key, earnings: 0, jobs: 0 }
  }
  earningsByDay.rows.forEach((r) => {
    const key = r.day ? new Date(r.day).toISOString().slice(0, 10) : null
    if (key && dayMap[key]) dayMap[key].earnings = Number(r.amount ?? 0)
  })
  jobsByDay.rows.forEach((r) => {
    const key = r.day ? new Date(r.day).toISOString().slice(0, 10) : null
    if (key && dayMap[key]) dayMap[key].jobs = r.count ?? 0
  })

  const series = Object.keys(dayMap)
    .sort()
    .map((k) => dayMap[k])

  return res.json({ series, days })
}))

// Wallet "transactions" (for now: escrow movements; later: payouts/fees/disputes ledger)
walletsRouter.get('/transactions', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select *
     from escrow_transactions
     where buyer_id = $1 or counterparty_user_id = $1
     order by created_at desc
     limit 50`,
    [req.user.sub],
  )
  return res.json(r.rows)
}))

const WithdrawSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['momo', 'bank']),
  details: z.record(z.any()).optional(),
})

walletsRouter.post('/withdraw', requireAuth, requireIdVerified(), asyncHandler(async (req, res) => {
  const parsed = WithdrawSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const amount = parsed.data.amount
  const idemRaw = getIdempotencyKeyFromReq(req)
  const idem = idemRaw ? `wallet_withdraw:${idemRaw}` : null

  const client = await pool.connect()
  try {
    await client.query('begin')

    if (idem) {
      const existing = await client.query(
        `select * from payouts where user_id = $1 and idempotency_key = $2 order by created_at desc limit 1 for update`,
        [req.user.sub, idem],
      )
      if (existing.rows[0]) {
        await client.query('commit')
        return res.status(200).json(existing.rows[0])
      }
    }

    const payout = await client.query(
      `insert into payouts (user_id, amount, currency, method, method_details, status, idempotency_key)
       values ($1,$2,$3,$4,$5,'pending',$6)
       returning *`,
      [req.user.sub, amount, 'GHS', parsed.data.method, parsed.data.details ?? null, idem],
    )

    // Debit wallet (atomic + ledgered)
    const debitRes = await debitWalletTx(client, {
      userId: req.user.sub,
      amount,
      currency: 'GHS',
      kind: 'withdraw_request',
      refType: 'payout',
      refId: payout.rows[0]?.id ?? null,
      idempotencyKey: idem ?? `wallet_withdraw_payout:${payout.rows[0]?.id ?? Date.now()}`,
      meta: { method: parsed.data.method, details: parsed.data.details ?? null },
    })
    if (debitRes?.insufficient) {
      await client.query('rollback')
      return res.status(400).json({ message: 'Insufficient balance' })
    }

    await client.query('commit')
    return res.status(201).json(payout.rows[0])
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

walletsRouter.get('/payouts', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query('select * from payouts where user_id = $1 order by created_at desc limit 50', [req.user.sub])
  return res.json(r.rows)
}))


