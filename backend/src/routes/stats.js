import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

/**
 * Public platform stats for social proof (no auth).
 * Used on home and buyer dashboard: "X jobs completed this week", "Trusted by Y users".
 */
export const statsRouter = Router()

statsRouter.get('/', asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)

  const [jobsRes, usersRes] = await Promise.all([
    pool.query(
      `select count(*)::int as n from jobs where status = 'completed' and updated_at >= $1`,
      [since],
    ),
    pool.query(
      `select count(*)::int as n from users where deleted_at is null`,
    ),
  ])

  const jobs_completed_7d = Number(jobsRes.rows[0]?.n ?? 0)
  const users_count = Number(usersRes.rows[0]?.n ?? 0)

  return res.json({
    jobs_completed_7d,
    users_count,
  })
}))
