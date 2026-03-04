/**
 * When a new job post is created, notify users who have a matching job alert subscription.
 */
import { pool } from '../db/pool.js'
import { notify } from './notifications.js'

function jobMatchesSubscription(job, sub) {
  const title = String(job?.title ?? '').toLowerCase()
  const desc = String(job?.description ?? '').toLowerCase()
  const loc = String(job?.location ?? '').toLowerCase()
  const q = String(sub?.q ?? '').trim().toLowerCase()
  const subLoc = String(sub?.location ?? '').trim().toLowerCase()
  const empType = String(job?.employment_type ?? '').trim()
  const subEmp = String(sub?.employment_type ?? '').trim()
  const workMode = String(job?.work_mode ?? '').trim()
  const subWork = String(sub?.work_mode ?? '').trim()

  if (q && !title.includes(q) && !desc.includes(q)) return false
  if (subLoc && !loc.includes(subLoc)) return false
  if (subEmp && empType !== subEmp) return false
  if (subWork && workMode !== subWork) return false
  return true
}

export async function notifyJobAlertSubscribers(jobPost) {
  if (!jobPost?.id) return
  try {
    const subs = await pool.query(
      'select id, user_id, name, q, location, employment_type, work_mode from job_alert_subscriptions',
      [],
    )
    const title = jobPost.title ?? 'Job'
    for (const sub of subs.rows || []) {
      if (!jobMatchesSubscription(jobPost, sub)) continue
      notify(sub.user_id, {
        type: 'job_alert',
        title: 'New job match',
        body: title,
        meta: { url: `/jobs/${jobPost.id}`, job_post_id: jobPost.id },
        dedupeKey: `job_alert:${sub.id}:${jobPost.id}`,
      }).catch(() => {})
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[jobAlertNotify]', e?.message ?? e)
  }
}
