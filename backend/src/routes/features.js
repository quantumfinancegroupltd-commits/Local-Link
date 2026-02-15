import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const featuresRouter = Router()

// Public read: used by landing page for "doors".
featuresRouter.get('/', asyncHandler(async (req, res) => {
  const r = await pool.query(`select key, enabled from feature_flags order by key asc`)
  const features = {}
  for (const row of r.rows) features[row.key] = !!row.enabled
  return res.json({ features })
}))


