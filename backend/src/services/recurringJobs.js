import { pool } from '../db/pool.js'

/** Create the next occurrence for a completed recurring job, if within end date. */
export async function createNextRecurringJobIfDue(completedJob) {
  const freq = String(completedJob.recurring_frequency ?? '').toLowerCase()
  const endDate = completedJob.recurring_end_date
  if (freq !== 'weekly' && freq !== 'monthly') return null
  if (!endDate) return null

  const prevAt = completedJob.scheduled_at ? new Date(completedJob.scheduled_at) : completedJob.completed_at ? new Date(completedJob.completed_at) : new Date()
  const next = new Date(prevAt)
  if (freq === 'weekly') next.setDate(next.getDate() + 7)
  else next.setMonth(next.getMonth() + 1)

  const end = new Date(endDate)
  if (next > end) return null

  const r = await pool.query(
    `insert into jobs (
       buyer_id, title, description, location, category, budget,
       scheduled_at, scheduled_end_at, recurring_frequency, recurring_end_date,
       image_url, media, location_place_id, location_lat, location_lng,
       access_instructions, event_head_count, event_menu_notes, event_equipment,
       invited_artisan_id, parent_job_id, status
     )
     values ($1,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9,$10::date,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20,$21,'open')
     returning id`,
    [
      completedJob.buyer_id,
      completedJob.title,
      completedJob.description,
      completedJob.location,
      completedJob.category ?? null,
      completedJob.budget ?? null,
      next.toISOString(),
      completedJob.scheduled_end_at ?? null,
      completedJob.recurring_frequency,
      completedJob.recurring_end_date,
      completedJob.image_url ?? null,
      completedJob.media ? JSON.stringify(completedJob.media) : null,
      completedJob.location_place_id ?? null,
      completedJob.location_lat ?? null,
      completedJob.location_lng ?? null,
      completedJob.access_instructions ?? null,
      completedJob.event_head_count ?? null,
      completedJob.event_menu_notes ?? null,
      completedJob.event_equipment ?? null,
      completedJob.invited_artisan_id ?? null,
      completedJob.id,
    ],
  )
  return r.rows[0]?.id ?? null
}
