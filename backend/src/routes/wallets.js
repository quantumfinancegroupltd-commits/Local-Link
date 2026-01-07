import { Router } from 'express'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'

export const walletsRouter = Router()

walletsRouter.get('/me', requireAuth, async (req, res) => {
  const r = await pool.query('select * from wallets where user_id = $1', [req.user.sub])
  if (!r.rows[0]) {
    const created = await pool.query(
      `insert into wallets (user_id, balance, currency)
       values ($1, 0, 'GHS')
       returning *`,
      [req.user.sub],
    )
    return res.json(created.rows[0])
  }
  return res.json(r.rows[0])
})


