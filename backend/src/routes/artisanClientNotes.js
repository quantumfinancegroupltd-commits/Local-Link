import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const artisanClientNotesRouter = Router()

const PutNotesSchema = z.object({
  notes: z.string().max(10000).optional().nullable(),
})

// GET one note for a buyer (by buyer user id)
artisanClientNotesRouter.get('/:buyerUserId', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const { buyerUserId } = req.params
  const r = await pool.query(
    'select notes, created_at, updated_at from artisan_client_notes where artisan_user_id = $1 and buyer_user_id = $2',
    [req.user.sub, buyerUserId],
  )
  if (!r.rows[0]) return res.json({ notes: null, created_at: null, updated_at: null })
  return res.json(r.rows[0])
}))

// PUT upsert note for a buyer
artisanClientNotesRouter.put('/:buyerUserId', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const { buyerUserId } = req.params
  const parsed = PutNotesSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const r = await pool.query(
    `insert into artisan_client_notes (artisan_user_id, buyer_user_id, notes)
     values ($1, $2, $3)
     on conflict (artisan_user_id, buyer_user_id)
     do update set notes = $3, updated_at = now()
     returning *`,
    [req.user.sub, buyerUserId, parsed.data.notes ?? null],
  )
  return res.json(r.rows[0])
}))
