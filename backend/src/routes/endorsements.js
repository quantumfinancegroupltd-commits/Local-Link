import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const endorsementsRouter = Router()

function normSkill(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

const JobEndorseSchema = z.object({
  skills: z
    .array(z.string().min(1))
    .min(1)
    .max(5)
    .transform((arr) => Array.from(new Set(arr.map(normSkill).filter(Boolean))).slice(0, 5)),
})

endorsementsRouter.get(
  '/user/:userId',
  asyncHandler(async (req, res) => {
    const uid = String(req.params.userId)
    const limit = Math.min(Math.max(Number(req.query.limit ?? 8) || 8, 1), 24)

    // Only show for active, non-deleted, non-suspended users.
    const userRes = await pool.query(
      `select id from users
       where id = $1
         and deleted_at is null
         and (suspended_until is null or suspended_until <= now())`,
      [uid],
    )
    if (!userRes.rows[0]) return res.status(404).json({ message: 'User not found' })

    const r = await pool.query(
      `
      select
        skill,
        count(*)::int as n,
        count(distinct endorser_user_id)::int as endorsers,
        max(created_at) as last_endorsed_at
      from skill_endorsements
      where provider_user_id = $1
      group by skill
      order by n desc, endorsers desc, skill asc
      limit $2
      `,
      [uid, limit],
    )

    const totals = await pool.query(
      `
      select
        count(*)::int as total_endorsements,
        count(distinct endorser_user_id)::int as total_endorsers
      from skill_endorsements
      where provider_user_id = $1
      `,
      [uid],
    )

    return res.json({
      user_id: uid,
      total_endorsements: Number(totals.rows[0]?.total_endorsements ?? 0),
      total_endorsers: Number(totals.rows[0]?.total_endorsers ?? 0),
      skills: r.rows.map((x) => ({
        skill: x.skill,
        count: Number(x.n ?? 0),
        endorsers: Number(x.endorsers ?? 0),
        last_endorsed_at: x.last_endorsed_at ?? null,
      })),
    })
  }),
)

endorsementsRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const uid = String(req.user.sub)
    const limit = Math.min(Math.max(Number(req.query.limit ?? 8) || 8, 1), 24)

    const r = await pool.query(
      `
      select
        skill,
        count(*)::int as n,
        count(distinct endorser_user_id)::int as endorsers,
        max(created_at) as last_endorsed_at
      from skill_endorsements
      where provider_user_id = $1
      group by skill
      order by n desc, endorsers desc, skill asc
      limit $2
      `,
      [uid, limit],
    )

    const totals = await pool.query(
      `
      select
        count(*)::int as total_endorsements,
        count(distinct endorser_user_id)::int as total_endorsers
      from skill_endorsements
      where provider_user_id = $1
      `,
      [uid],
    )

    return res.json({
      user_id: uid,
      total_endorsements: Number(totals.rows[0]?.total_endorsements ?? 0),
      total_endorsers: Number(totals.rows[0]?.total_endorsers ?? 0),
      skills: r.rows.map((x) => ({
        skill: x.skill,
        count: Number(x.n ?? 0),
        endorsers: Number(x.endorsers ?? 0),
        last_endorsed_at: x.last_endorsed_at ?? null,
      })),
    })
  }),
)

// Buyer endorses the artisan's skills after a completed, paid-out job.
endorsementsRouter.post(
  '/jobs/:jobId',
  requireAuth,
  requireRole(['buyer']),
  asyncHandler(async (req, res) => {
    const parsed = JobEndorseSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const jobRes = await pool.query('select * from jobs where id = $1', [req.params.jobId])
    const job = jobRes.rows[0]
    if (!job) return res.status(404).json({ message: 'Job not found' })
    if (job.buyer_id !== req.user.sub) return res.status(403).json({ message: 'Forbidden' })
    if (!job.assigned_artisan_id) return res.status(400).json({ message: 'Job has no assigned artisan' })
    if (String(job.status || '') !== 'completed') return res.status(400).json({ message: 'Endorsements are available after completion.' })

    const escrowRes = await pool.query(
      `select status from escrow_transactions where type='job' and job_id = $1 order by created_at desc limit 1`,
      [job.id],
    )
    const escrowStatus = escrowRes.rows[0]?.status
    if (escrowStatus !== 'released') return res.status(400).json({ message: 'Endorsements become available after escrow is released.' })

    const artisanRes = await pool.query('select user_id, skills, primary_skill from artisans where id = $1', [job.assigned_artisan_id])
    const artisan = artisanRes.rows[0]
    const providerUserId = artisan?.user_id ?? null
    if (!providerUserId) return res.status(400).json({ message: 'Artisan user not found' })

    const allowed = new Map()
    const list = Array.isArray(artisan?.skills) ? artisan.skills : []
    for (const raw of list) {
      const s = normSkill(raw)
      if (s) allowed.set(s.toLowerCase(), s)
    }
    const ps = normSkill(artisan?.primary_skill)
    if (ps) allowed.set(ps.toLowerCase(), ps)

    // Only allow endorsing skills the provider actually lists.
    const selected = parsed.data.skills
      .map((s) => {
        const key = String(s).toLowerCase()
        return allowed.get(key) ?? null
      })
      .filter(Boolean)

    if (!selected.length) {
      return res.status(400).json({ message: 'Select at least 1 valid skill to endorse.' })
    }

    const client = await pool.connect()
    try {
      await client.query('begin')
      let inserted = 0
      for (const skill of selected) {
        // eslint-disable-next-line no-await-in-loop
        const ins = await client.query(
          `
          insert into skill_endorsements (provider_user_id, endorser_user_id, context_type, context_id, skill)
          values ($1,$2,'job',$3,$4)
          on conflict (endorser_user_id, context_type, context_id, skill) do nothing
          returning id
          `,
          [providerUserId, req.user.sub, job.id, skill],
        )
        if (ins.rows[0]) inserted += 1
      }
      await client.query('commit')
      return res.status(201).json({ ok: true, inserted, provider_user_id: providerUserId, skills: selected })
    } catch (e) {
      try {
        await client.query('rollback')
      } catch {}
      throw e
    } finally {
      client.release()
    }
  }),
)

