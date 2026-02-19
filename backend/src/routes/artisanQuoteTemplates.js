import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const artisanQuoteTemplatesRouter = Router()

async function getArtisanId(userId) {
  const r = await pool.query('select id from artisans where user_id = $1 limit 1', [userId])
  return r.rows[0]?.id ?? null
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  message: z.string().max(5000).optional().nullable(),
  quote_amount: z.number().positive().optional().nullable(),
  availability_text: z.string().max(200).optional().nullable(),
  start_within_days: z.number().int().min(0).max(365).optional().nullable(),
  warranty_days: z.number().int().min(0).max(3650).optional().nullable(),
  includes_materials: z.boolean().optional().nullable(),
})

artisanQuoteTemplatesRouter.get('/', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const artisanId = await getArtisanId(req.user.sub)
  if (!artisanId) return res.json([])
  const r = await pool.query(
    'select * from quote_templates where artisan_id = $1 order by created_at desc limit 50',
    [artisanId],
  )
  return res.json(r.rows)
}))

artisanQuoteTemplatesRouter.post('/', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const artisanId = await getArtisanId(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Artisan profile required' })
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const d = parsed.data
  const r = await pool.query(
    `insert into quote_templates (artisan_id, name, message, quote_amount, availability_text, start_within_days, warranty_days, includes_materials)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning *`,
    [
      artisanId,
      d.name,
      d.message ?? null,
      d.quote_amount ?? null,
      d.availability_text ?? null,
      d.start_within_days ?? null,
      d.warranty_days ?? null,
      d.includes_materials ?? false,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

artisanQuoteTemplatesRouter.delete('/:id', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const artisanId = await getArtisanId(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Artisan profile required' })
  const r = await pool.query(
    'delete from quote_templates where id = $1 and artisan_id = $2 returning id',
    [req.params.id, artisanId],
  )
  if (r.rowCount === 0) return res.status(404).json({ message: 'Template not found' })
  return res.status(204).send()
}))
