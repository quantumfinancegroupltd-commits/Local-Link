import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

export const jobsRouter = Router()

jobsRouter.get('/', requireAuth, async (req, res) => {
  // Phase 1: buyers see their jobs; artisans see open jobs; admin sees all
  const role = req.user.role
  const userId = req.user.sub

  let rows = []
  if (role === 'buyer') {
    const r = await pool.query('select * from jobs where buyer_id = $1 order by created_at desc', [userId])
    rows = r.rows
  } else if (role === 'artisan') {
    const r = await pool.query("select * from jobs where status = 'open' order by created_at desc")
    rows = r.rows
  } else {
    const r = await pool.query('select * from jobs order by created_at desc')
    rows = r.rows
  }

  return res.json(rows)
})

const CreateJobSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  budget: z.number().nullable().optional(),
})

jobsRouter.post('/', requireAuth, requireRole(['buyer', 'admin']), async (req, res) => {
  const parsed = CreateJobSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  const { title, description, location, budget } = parsed.data
  const r = await pool.query(
    `insert into jobs (buyer_id, title, description, location, budget)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [req.user.sub, title, description, location, budget ?? null],
  )
  return res.status(201).json(r.rows[0])
})

jobsRouter.get('/:id', requireAuth, async (req, res) => {
  const r = await pool.query('select * from jobs where id = $1', [req.params.id])
  if (!r.rows[0]) return res.status(404).json({ message: 'Job not found' })
  return res.json(r.rows[0])
})

const SubmitQuoteSchema = z.object({
  quote_amount: z.number().positive(),
  message: z.string().optional().nullable(),
})

jobsRouter.post('/:id/quote', requireAuth, requireRole(['artisan']), async (req, res) => {
  const parsed = SubmitQuoteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' })

  // Ensure artisan profile exists
  const artisanRes = await pool.query('select id from artisans where user_id = $1', [req.user.sub])
  const artisan = artisanRes.rows[0]
  if (!artisan) return res.status(400).json({ message: 'Create artisan profile first' })

  const r = await pool.query(
    `insert into quotes (job_id, artisan_id, quote_amount, message)
     values ($1,$2,$3,$4)
     returning *`,
    [req.params.id, artisan.id, parsed.data.quote_amount, parsed.data.message ?? null],
  )
  return res.status(201).json(r.rows[0])
})

jobsRouter.get('/:id/quotes', requireAuth, async (req, res) => {
  const r = await pool.query(
    `select q.*,
            a.user_id as artisan_user_id
     from quotes q
     join artisans a on a.id = q.artisan_id
     where q.job_id = $1
     order by q.created_at desc`,
    [req.params.id],
  )
  return res.json(r.rows)
})


