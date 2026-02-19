import { pool } from '../db/pool.js'
import { notifyWithSms } from './messaging/index.js'

/**
 * Find open jobs that have pending quotes older than 24h and haven't had a follow-up nudge yet.
 * Send one in-app + optional SMS nudge to the buyer to review quotes.
 */
export async function runQuoteFollowUpNudge({ limit = 50 } = {}) {
  const r = await pool.query(
    `select j.id as job_id, j.buyer_id, j.title,
            (select min(q.created_at) from quotes q where q.job_id = j.id and q.status = 'pending') as oldest_pending_at
     from jobs j
     where j.status = 'open'
       and j.buyer_id is not null
       and j.deleted_at is null
       and exists (
         select 1 from quotes q
         where q.job_id = j.id and q.status = 'pending'
           and q.created_at < now() - interval '24 hours'
       )
       and not exists (
         select 1 from quote_followup_sent s where s.job_id = j.id
       )
     order by oldest_pending_at asc
     limit $1`,
    [limit],
  )

  let sent = 0
  for (const row of r.rows) {
    const buyerId = row.buyer_id
    const jobId = row.job_id
    const title = row.title || 'Your job'

    try {
      await notifyWithSms(buyerId, {
        type: 'quote_followup',
        title: 'Quotes are waiting for you',
        body: `You have quotes on "${title}". Review and accept one to get started.`,
        meta: { url: `/buyer/jobs/${jobId}`, job_id: jobId },
        dedupeKey: `quote_followup:${jobId}`,
      })
      await pool.query(
        'insert into quote_followup_sent (job_id) values ($1) on conflict (job_id) do nothing',
        [jobId],
      )
      sent += 1
    } catch (e) {
      // Log but don't fail the whole sweep; next run will retry (we didn't insert into quote_followup_sent)
      console.error('Quote follow-up nudge failed for job', jobId, e?.message ?? e)
    }
  }

  return { sent, candidates: r.rows.length }
}
