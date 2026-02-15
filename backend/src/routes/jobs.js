import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireIdVerified, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { notify } from '../services/notifications.js'
import { creditWalletTx } from '../services/walletLedger.js'

export const jobsRouter = Router()

jobsRouter.get('/', requireAuth, asyncHandler(async (req, res) => {
  // Phase 1: buyers see their jobs; artisans see open jobs; admin sees all
  const role = req.user.role
  const userId = req.user.sub

  let rows = []
  if (role === 'buyer') {
    const r = await pool.query('select * from jobs where buyer_id = $1 and deleted_at is null order by created_at desc', [userId])
    rows = r.rows
  } else if (role === 'artisan') {
    const r = await pool.query("select * from jobs where status = 'open' and deleted_at is null order by created_at desc")
    rows = r.rows
  } else {
    const includeDeleted =
      String(req.query.include_deleted ?? '').toLowerCase() === '1' ||
      String(req.query.include_deleted ?? '').toLowerCase() === 'true'
    const r = await pool.query(
      `select * from jobs
       where ($1::boolean = true or deleted_at is null)
       order by created_at desc`,
      [includeDeleted],
    )
    rows = r.rows
  }

  return res.json(rows)
}))

const MineJobsQuery = z.object({
  open_limit: z.preprocess((v) => (v == null || v === '' ? 50 : Number(v)), z.number().int().min(0).max(200)).optional(),
})

jobsRouter.get('/mine', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const parsed = MineJobsQuery.safeParse(req.query ?? {})
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const artisanId = await ensureArtisanIdExists(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Unable to create artisan profile' })

  const openLimit = Number(parsed.data.open_limit ?? 50)

  const r = await pool.query(
    `with      my_quotes as (
       select distinct on (q.job_id)
              q.job_id,
              q.id as quote_id,
              q.status::text as quote_status,
              q.quote_amount as quote_amount,
              q.created_at as quote_created_at
       from quotes q
       where q.artisan_id = $1
       order by q.job_id, q.created_at desc
     ),
     my_jobs as (
       select j.*,
              mq.quote_id,
              mq.quote_status,
              mq.quote_amount,
              mq.quote_created_at
       from jobs j
       left join my_quotes mq on mq.job_id = j.id
       where j.deleted_at is null
         and (j.assigned_artisan_id = $1 or mq.quote_id is not null)
     ),
     open_leads as (
       select j.*,
              null::uuid as quote_id,
              null::text as quote_status,
              null::numeric as quote_amount,
              null::timestamptz as quote_created_at
       from jobs j
       where j.deleted_at is null
         and j.status = 'open'
         and not exists (select 1 from quotes q where q.job_id = j.id and q.artisan_id = $1)
       order by j.created_at desc
       limit $2
     ),
     base as (
       select * from my_jobs
       union all
       select * from open_leads
     ),
     with_escrow as (
       select b.*,
              e.id as escrow_id,
              e.status as escrow_status,
              e.amount as escrow_amount,
              e.currency as escrow_currency,
              e.created_at as escrow_created_at
       from base b
       left join lateral (
         select e.*
         from escrow_transactions e
         where e.type = 'job' and e.job_id = b.id
         order by e.created_at desc
         limit 1
       ) e on true
     ),
     with_dispute as (
       select we.*,
              d.id as dispute_id,
              d.status as dispute_status,
              d.reason as dispute_reason
       from with_escrow we
       left join lateral (
         select d.*
         from disputes d
         where d.escrow_id = we.escrow_id
           and d.status in ('open','under_review')
         order by d.created_at desc
         limit 1
       ) d on true
     )
     select *
     from with_dispute
     order by greatest(coalesce(quote_created_at, created_at), coalesce(updated_at, created_at)) desc`,
    [artisanId, openLimit],
  )

  const items = (r.rows || []).map((row) => {
    const jobStatus = String(row.status || 'open')
    const escrowStatus = row.escrow_status ? String(row.escrow_status) : null
    const disputeStatus = row.dispute_status ? String(row.dispute_status) : null
    const quoteStatus = row.quote_status ? String(row.quote_status) : null
    const hasDispute = Boolean(disputeStatus) || escrowStatus === 'disputed'
    const isPaid = escrowStatus === 'released'

    let stage = 'other'
    if (hasDispute) stage = 'disputed'
    else if (isPaid) stage = 'paid'
    else if (jobStatus === 'completed') stage = 'completed'
    else if (jobStatus === 'in_progress') stage = 'in_progress'
    else if (jobStatus === 'assigned') stage = 'booked'
    else if (jobStatus === 'open') {
      if (!quoteStatus) stage = 'new'
      else if (quoteStatus === 'pending') stage = 'quoted'
      else if (quoteStatus === 'rejected') stage = 'rejected'
      else stage = 'quoted'
    } else if (jobStatus === 'cancelled') stage = 'cancelled'

    return {
      ...row,
      my_quote: row.quote_id
        ? {
            id: row.quote_id,
            status: quoteStatus,
            amount: row.quote_amount,
            created_at: row.quote_created_at,
          }
        : null,
      escrow: row.escrow_id
        ? {
            id: row.escrow_id,
            status: escrowStatus,
            amount: row.escrow_amount,
            currency: row.escrow_currency,
            created_at: row.escrow_created_at,
          }
        : null,
      dispute: row.dispute_id ? { id: row.dispute_id, status: disputeStatus, reason: row.dispute_reason } : null,
      stage,
    }
  })

  const counts = items.reduce((acc, it) => {
    const k = String(it?.stage || 'other')
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  return res.json({ items, counts })
}))

const CreateJobSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  category: z.string().max(80).optional().nullable(),
  budget: z.number().nullable().optional(),
  // Accept internal upload URLs like "/api/uploads/<file>" (not a full absolute URL).
  image_url: z.string().min(1).nullable().optional(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        kind: z.enum(['image', 'video']).optional(),
        mime: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .optional()
    .nullable(),
  location_place_id: z.string().nullable().optional(),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional(),
})

jobsRouter.post('/', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const parsed = CreateJobSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { title, description, location, category, budget, image_url, media, location_place_id, location_lat, location_lng } =
    parsed.data

  // IMPORTANT: node-postgres treats JS Arrays as Postgres array literals ("{...}"), not JSON.
  // Our column is jsonb, so explicitly stringify arrays and cast to jsonb in SQL.
  const mediaJson = media == null ? null : JSON.stringify(media)

  const r = await pool.query(
    `insert into jobs (buyer_id, title, description, location, category, budget, image_url, media, location_place_id, location_lat, location_lng)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
     returning *`,
    [
      req.user.sub,
      title,
      description,
      location,
      category ?? null,
      budget ?? null,
      image_url ?? null,
      mediaJson,
      location_place_id ?? null,
      location_lat ?? null,
      location_lng ?? null,
    ],
  )
  return res.status(201).json(r.rows[0])
}))

jobsRouter.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const r = await pool.query('select * from jobs where id = $1', [req.params.id])
  const job = r.rows[0] ?? null
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.deleted_at && req.user.role !== 'admin') return res.status(404).json({ message: 'Job not found' })

  // Basic access control:
  // - buyer: only own jobs
  // - artisan: open jobs OR jobs assigned to them
  // - admin: all
  if (req.user.role === 'buyer') {
    if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
  } else if (req.user.role === 'artisan') {
    const artisanId = await ensureArtisanId(req.user.sub)
    const canSee = job.status === 'open' || (artisanId && job.assigned_artisan_id === artisanId)
    if (!canSee) return res.status(403).json({ message: 'Forbidden' })
  }

  return res.json(job)
}))

const JobProofCreateSchema = z.object({
  kind: z.enum(['before', 'after', 'other']).optional(),
  note: z.string().max(2000).optional().nullable(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        kind: z.enum(['image', 'video']).optional(),
        mime: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .max(12)
    .optional()
    .nullable(),
})

jobsRouter.get('/:id/proofs', requireAuth, asyncHandler(async (req, res) => {
  const jobRes = await pool.query('select * from jobs where id = $1', [req.params.id])
  const job = jobRes.rows[0] ?? null
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.deleted_at && req.user.role !== 'admin') return res.status(404).json({ message: 'Job not found' })

  if (req.user.role === 'buyer') {
    if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
  } else if (req.user.role === 'artisan') {
    const artisanId = await ensureArtisanId(req.user.sub)
    const canSee = artisanId && job.assigned_artisan_id === artisanId
    if (!canSee) return res.status(403).json({ message: 'Forbidden' })
  }

  const r = await pool.query(
    `select p.*,
            u.name as created_by_name,
            u.profile_pic as created_by_profile_pic
     from job_proofs p
     left join users u on u.id = p.created_by_user_id
     where p.job_id = $1
     order by p.created_at asc
     limit 50`,
    [job.id],
  )
  return res.json(r.rows)
}))

jobsRouter.post('/:id/proofs', requireAuth, requireRole(['artisan']), requireIdVerified(), asyncHandler(async (req, res) => {
  const parsed = JobProofCreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const artisanId = await ensureArtisanIdExists(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Unable to create artisan profile' })

  const jobRes = await pool.query('select * from jobs where id = $1', [req.params.id])
  const job = jobRes.rows[0] ?? null
  if (!job || job.deleted_at) return res.status(404).json({ message: 'Job not found' })
  if (job.assigned_artisan_id !== artisanId) return res.status(403).json({ message: 'Forbidden' })
  if (!['assigned', 'in_progress', 'completed'].includes(String(job.status || ''))) {
    return res.status(400).json({ message: `Cannot add proof while job is '${job.status}'` })
  }

  const mediaJson = parsed.data.media == null ? null : JSON.stringify(parsed.data.media)
  const kind = String(parsed.data.kind ?? 'other')
  const note = parsed.data.note ?? null

  const r = await pool.query(
    `insert into job_proofs (job_id, created_by_user_id, kind, note, media)
     values ($1,$2,$3,$4,$5::jsonb)
     returning *`,
    [job.id, req.user.sub, kind, note, mediaJson],
  )
  return res.status(201).json(r.rows[0])
}))

async function ensureArtisanId(userId) {
  const artisanRes = await pool.query('select id from artisans where user_id = $1', [userId])
  return artisanRes.rows[0]?.id ?? null
}

async function ensureArtisanIdExists(userId) {
  // Create a minimal artisan profile automatically to avoid blocking core flow.
  // The artisan can still fill in skills/service area later in Profile.
  const r = await pool.query(
    `insert into artisans (user_id)
     values ($1)
     on conflict (user_id) do update set updated_at = now()
     returning id`,
    [userId],
  )
  return r.rows[0]?.id ?? null
}

// Artisan marks job started (internal workflow)
jobsRouter.post('/:id/start', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const artisanId = await ensureArtisanIdExists(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Unable to create artisan profile' })

  const r = await pool.query('select * from jobs where id = $1', [req.params.id])
  const job = r.rows[0]
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (job.assigned_artisan_id !== artisanId) return res.status(403).json({ message: 'Forbidden' })
  if (!['assigned', 'in_progress'].includes(job.status)) return res.status(400).json({ message: 'Job not ready to start' })

  await pool.query(`update jobs set status='in_progress', started_at = coalesce(started_at, now()), updated_at = now() where id = $1`, [
    job.id,
  ])
  return res.json({ ok: true })
}))

// Artisan marks job completed (moves escrow to completed_pending_confirmation if held)
jobsRouter.post('/:id/complete', requireAuth, requireRole(['artisan']), asyncHandler(async (req, res) => {
  const artisanId = await ensureArtisanIdExists(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Unable to create artisan profile' })

  const client = await pool.connect()
  try {
    await client.query('begin')
    const jr = await client.query('select * from jobs where id = $1 for update', [req.params.id])
    const job = jr.rows[0]
    if (!job) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Job not found' })
    }
    if (job.assigned_artisan_id !== artisanId) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (!['in_progress', 'assigned'].includes(job.status)) {
      await client.query('rollback')
      return res.status(400).json({ message: `Cannot complete job in status '${job.status}'` })
    }

    await client.query(
      `update jobs
       set status='completed',
           provider_completed_at = now(),
           completed_at = now(),
           updated_at = now()
       where id = $1`,
      [job.id],
    )

    const er = await client.query(
      `select * from escrow_transactions where type='job' and job_id = $1 order by created_at desc limit 1 for update`,
      [job.id],
    )
    const escrow = er.rows[0]
    if (escrow && escrow.status === 'held') {
      await client.query(
        `update escrow_transactions set status='completed_pending_confirmation', updated_at = now() where id = $1`,
        [escrow.id],
      )
    }

    await client.query('commit')

    // Notify buyer (best-effort)
    notify({
      userId: job.buyer_id ?? null,
      type: 'job_completed',
      title: 'Job marked complete',
      body: 'Your provider marked the job as completed. Confirm completion (or open a dispute) in Trust Wallet.',
      meta: { url: `/buyer/jobs/${job.id}/escrow`, job_id: job.id },
      dedupeKey: `job:${job.id}:completed`,
    }).catch(() => {})

    return res.json({ ok: true })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// Buyer/admin can cancel a job before completion (refunds any held escrow back to buyer wallet).
jobsRouter.post('/:id/cancel', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')

    const jr = await client.query('select * from jobs where id = $1 for update', [req.params.id])
    const job = jr.rows[0]
    if (!job) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Job not found' })
    }
    if (job.deleted_at) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Job not found' })
    }
    if (req.user.role === 'buyer' && job.buyer_id !== req.user.sub) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }
    if (job.status === 'cancelled') {
      await client.query('rollback')
      return res.json({ ok: true, message: 'Job already cancelled.' })
    }
    if (job.status === 'completed') {
      await client.query('rollback')
      return res.status(400).json({ message: 'Cannot cancel a completed job. Use dispute instead.' })
    }

    const er = await client.query(
      `select * from escrow_transactions where type='job' and job_id = $1 order by created_at desc limit 1 for update`,
      [job.id],
    )
    const escrow = er.rows[0] ?? null

    if (escrow) {
      const disputeRes = await client.query(
        `select 1
         from disputes
         where escrow_id = $1
           and status in ('open','under_review')
         limit 1`,
        [escrow.id],
      )
      if (disputeRes.rowCount > 0 || escrow.status === 'disputed') {
        await client.query('rollback')
        return res.status(409).json({ message: 'This job has an active dispute; it cannot be cancelled.' })
      }

      if (escrow.status === 'held') {
        const amt = Number(escrow.amount ?? 0)
        if (amt > 0 && escrow.buyer_id) {
          await creditWalletTx(client, {
            userId: escrow.buyer_id,
            amount: amt,
            currency: escrow.currency ?? 'GHS',
            kind: 'escrow_refund',
            refType: 'escrow',
            refId: escrow.id,
            idempotencyKey: `escrow_refund:${escrow.id}`,
            meta: { job_id: escrow.job_id ?? job.id, cancelled_by: req.user.sub },
          })
        }
        await client.query(
          `update escrow_transactions
           set status='refunded', updated_at = now(),
               meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('cancelled_by', $2)
           where id = $1`,
          [escrow.id, req.user.sub],
        )
      } else if (escrow.status === 'pending_payment') {
        await client.query(
          `update escrow_transactions
           set status='cancelled', updated_at = now(),
               meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('cancelled_by', $2)
           where id = $1`,
          [escrow.id, req.user.sub],
        )
      }
    }

    await client.query(`update jobs set status='cancelled', updated_at = now() where id = $1`, [job.id])

    await client.query('commit')

    // Notify assigned artisan (if any) (best-effort)
    if (job.assigned_artisan_id) {
      pool
        .query('select user_id from artisans where id = $1', [job.assigned_artisan_id])
        .then((a) => {
          const artisanUserId = a.rows[0]?.user_id ?? null
          return notify({
            userId: artisanUserId,
            type: 'job_cancelled',
            title: 'Job cancelled',
            body: 'A buyer cancelled a job you were assigned to.',
            meta: { url: `/artisan/jobs/${job.id}`, job_id: job.id },
            dedupeKey: `job:${job.id}:cancelled`,
          })
        })
        .catch(() => {})
    }

    return res.json({ ok: true })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

// Buyer/admin can "delete" (soft-delete) a job only when it's safely outside the active cycle.
// - Allowed job statuses: open, cancelled, completed
// - Block if latest escrow is active (pending/held/in_progress/disputed/completed_pending_confirmation)
// - Block if there's an active dispute
jobsRouter.delete('/:id', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')

    const jr = await client.query('select * from jobs where id = $1 for update', [req.params.id])
    const job = jr.rows[0] ?? null
    if (!job) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Job not found' })
    }
    if (job.deleted_at) {
      await client.query('rollback')
      return res.json({ ok: true })
    }
    if (req.user.role === 'buyer' && job.buyer_id !== req.user.sub) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }

    const allowedStatuses = new Set(['open', 'cancelled', 'completed'])
    if (!allowedStatuses.has(job.status)) {
      await client.query('rollback')
      return res.status(409).json({ message: 'This job is in progress and cannot be deleted.' })
    }

    const er = await client.query(
      `select * from escrow_transactions
       where type='job' and job_id = $1
       order by created_at desc
       limit 1
       for update`,
      [job.id],
    )
    const escrow = er.rows[0] ?? null

    if (escrow) {
      const disputeRes = await client.query(
        `select 1
         from disputes
         where escrow_id = $1
           and status in ('open','under_review')
         limit 1`,
        [escrow.id],
      )
      if (disputeRes.rowCount > 0 || escrow.status === 'disputed') {
        await client.query('rollback')
        return res.status(409).json({ message: 'This job has an active dispute and cannot be deleted.' })
      }

      const safeEscrowStatuses = new Set(['released', 'refunded', 'cancelled', 'failed'])
      if (!safeEscrowStatuses.has(String(escrow.status || ''))) {
        await client.query('rollback')
        return res.status(409).json({ message: 'This job has an active escrow and cannot be deleted yet.' })
      }
    }

    await client.query(
      `update jobs
       set deleted_at = now(),
           deleted_by = $2,
           updated_at = now()
       where id = $1`,
      [job.id, req.user.sub],
    )

    await client.query('commit')
    return res.json({ ok: true })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

const SubmitQuoteSchema = z.object({
  quote_amount: z.number().positive(),
  message: z.string().optional().nullable(),
  availability_text: z.string().max(200).optional().nullable(),
  start_within_days: z.number().int().min(0).max(365).optional().nullable(),
  warranty_days: z.number().int().min(0).max(3650).optional().nullable(),
  includes_materials: z.boolean().optional().nullable(),
})

jobsRouter.post('/:id/quote', requireAuth, requireRole(['artisan']), requireIdVerified(), asyncHandler(async (req, res) => {
  const parsed = SubmitQuoteSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const artisanId = await ensureArtisanIdExists(req.user.sub)
  if (!artisanId) return res.status(400).json({ message: 'Unable to create artisan profile' })

  const jobRes = await pool.query('select id, status, deleted_at, buyer_id, title from jobs where id = $1', [req.params.id])
  const job = jobRes.rows[0] ?? null
  if (!job || job.deleted_at) return res.status(404).json({ message: 'Job not found' })
  if (job.status !== 'open') return res.status(400).json({ message: 'Quotes are only allowed while the job is open.' })

  const r = await pool.query(
    `insert into quotes (job_id, artisan_id, quote_amount, message, availability_text, start_within_days, warranty_days, includes_materials, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,now())
     returning *`,
    [
      req.params.id,
      artisanId,
      parsed.data.quote_amount,
      parsed.data.message ?? null,
      parsed.data.availability_text ?? null,
      parsed.data.start_within_days ?? null,
      parsed.data.warranty_days ?? null,
      parsed.data.includes_materials ?? null,
    ],
  )
  // Notify buyer that a quote arrived (in-app + optional SMS)
  const { notifyWithSms } = await import('../services/messaging/index.js')
  notifyWithSms(job.buyer_id ?? null, {
    type: 'quote_received',
    title: 'New quote received',
    body: `You received a new quote${job?.title ? ` for "${job.title}"` : ''}.`,
    meta: { url: `/buyer/jobs/${job.id}`, job_id: job.id, quote_id: r.rows[0]?.id ?? null },
    dedupeKey: `job:${job.id}:quote`,
  }).catch(() => {})

  return res.status(201).json(r.rows[0])
}))

jobsRouter.get('/:id/quotes', requireAuth, asyncHandler(async (req, res) => {
  const jobRes = await pool.query('select id, buyer_id, status, deleted_at from jobs where id = $1', [req.params.id])
  const job = jobRes.rows[0] ?? null
  if (!job || job.deleted_at) return res.status(404).json({ message: 'Job not found' })
  const isAdmin = req.user.role === 'admin'
  const isBuyerOwner = req.user.role === 'buyer' && job.buyer_id === req.user.sub
  let artisanId = null
  let isArtisanWithQuote = false
  if (req.user.role === 'artisan') {
    artisanId = await ensureArtisanId(req.user.sub)
    if (artisanId) {
      const qc = await pool.query(`select 1 from quotes where job_id = $1 and artisan_id = $2 limit 1`, [req.params.id, artisanId])
      isArtisanWithQuote = qc.rowCount > 0
    }
  }
  if (!isAdmin && !isBuyerOwner && !isArtisanWithQuote) return res.status(403).json({ message: 'Forbidden' })

  const r = await pool.query(
    `select q.*,
            a.user_id as artisan_user_id,
            a.primary_skill as artisan_primary_skill,
            a.skills as artisan_skills,
            u.name as artisan_name,
            u.profile_pic as artisan_profile_pic,
            u.rating as artisan_rating,
            u.trust_score as artisan_trust_score,
            coalesce(v.level, 'unverified') as verification_tier
     from quotes q
     join artisans a on a.id = q.artisan_id
     join users u on u.id = a.user_id
     left join verification_levels v on v.user_id = u.id
     where q.job_id = $1
       and ($2::uuid is null or q.artisan_id = $2)
     order by q.created_at desc`,
    [req.params.id, req.user.role === 'artisan' ? artisanId : null],
  )
  return res.json(r.rows)
}))


