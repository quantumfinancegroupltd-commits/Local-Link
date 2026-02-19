import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const jobTemplatesRouter = Router()

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  location_place_id: z.string().max(500).optional().nullable(),
  location_lat: z.number().min(-90).max(90).optional().nullable(),
  location_lng: z.number().min(-180).max(180).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  budget: z.number().optional().nullable(),
  recurring_frequency: z.string().max(50).optional().nullable(),
  recurring_end_date: z.string().optional().nullable(),
  access_instructions: z.string().max(2000).optional().nullable(),
  event_head_count: z.union([z.number(), z.string()]).optional().nullable(),
  event_menu_notes: z.string().max(5000).optional().nullable(),
  event_equipment: z.string().max(2000).optional().nullable(),
})

const CreateFromJobSchema = z.object({
  name: z.string().min(1).max(120),
  job_id: z.string().uuid(),
})

// List buyer's templates
jobTemplatesRouter.get('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const r = await pool.query(
    'select * from job_templates where buyer_id = $1 order by created_at desc limit 50',
    [buyerId],
  )
  return res.json(r.rows)
}))

// Create template from form data
jobTemplatesRouter.post('/', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const parsed = CreateTemplateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
  const d = parsed.data
  const eventHeadCount = d.event_head_count != null ? String(d.event_head_count) : null
  const recurringEndDate = d.recurring_end_date && d.recurring_end_date.trim() !== '' ? d.recurring_end_date : null

  const r = await pool.query(
    `insert into job_templates (buyer_id, name, title, description, location, location_place_id, location_lat, location_lng, category, budget, recurring_frequency, recurring_end_date, access_instructions, event_head_count, event_menu_notes, event_equipment)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14,$15,$16)
     returning *`,
    [
      buyerId,
      d.name,
      d.title,
      d.description ?? null,
      d.location ?? null,
      d.location_place_id ?? null,
      d.location_lat ?? null,
      d.location_lng ?? null,
      d.category ?? null,
      d.budget ?? null,
      d.recurring_frequency ?? null,
      recurringEndDate,
      d.access_instructions ?? null,
      eventHeadCount,
      d.event_menu_notes ?? null,
      d.event_equipment ?? null,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

// Create template from an existing job (buyer must own the job)
jobTemplatesRouter.post('/from-job', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const parsed = CreateFromJobSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const job = await pool.query(
    'select * from jobs where id = $1 and buyer_id = $2 and deleted_at is null',
    [parsed.data.job_id, buyerId],
  )
  if (!job.rows[0]) return res.status(404).json({ message: 'Job not found' })
  const j = job.rows[0]

  const r = await pool.query(
    `insert into job_templates (buyer_id, name, title, description, location, location_place_id, location_lat, location_lng, category, budget, recurring_frequency, recurring_end_date, access_instructions, event_head_count, event_menu_notes, event_equipment)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14,$15,$16)
     returning *`,
    [
      buyerId,
      parsed.data.name,
      j.title,
      j.description,
      j.location,
      j.location_place_id,
      j.location_lat,
      j.location_lng,
      j.category,
      j.budget,
      j.recurring_frequency,
      j.recurring_end_date,
      j.access_instructions,
      j.event_head_count != null ? String(j.event_head_count) : null,
      j.event_menu_notes,
      j.event_equipment,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

// Delete template
jobTemplatesRouter.delete('/:id', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const buyerId = req.user.sub
  const id = z.string().uuid().safeParse(req.params.id)
  if (!id.success) return res.status(400).json({ message: 'Invalid template id' })

  const r = await pool.query('delete from job_templates where id = $1 and buyer_id = $2 returning id', [id.data, buyerId])
  if (!r.rowCount) return res.status(404).json({ message: 'Template not found' })
  return res.json({ ok: true })
}))
