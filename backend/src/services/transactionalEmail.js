/**
 * Transactional emails for key platform events.
 * Uses existing mailer (SMTP from env). No-op if SMTP not configured.
 */
import { pool } from '../db/pool.js'
import { sendEmail } from './mailer.js'

const APP_NAME = 'LocalLink'

async function getUserEmail(userId) {
  if (!userId) return null
  const r = await pool.query('select email from users where id = $1 and deleted_at is null', [userId])
  return r.rows[0]?.email ?? null
}

export async function sendOrderConfirmedEmail({ orderId, buyerId }) {
  const to = await getUserEmail(buyerId)
  if (!to) return { ok: false, reason: 'no_email' }
  const subject = `${APP_NAME} – Order confirmed`
  const text = `Your order has been confirmed and paid. We'll notify you when it's on its way.\n\nView order: ${process.env.APP_BASE_URL || 'https://locallink.agency'}/buyer/orders`
  await sendEmail({ to, subject, text })
  return { ok: true }
}

export async function sendQuoteReceivedEmail({ buyerId, jobId, artisanName }) {
  const to = await getUserEmail(buyerId)
  if (!to) return { ok: false, reason: 'no_email' }
  const subject = `${APP_NAME} – New quote received`
  const text = `${artisanName || 'A provider'} sent you a quote for your job.\n\nView and respond: ${process.env.APP_BASE_URL || 'https://locallink.agency'}/buyer/jobs/${jobId}`
  await sendEmail({ to, subject, text })
  return { ok: true }
}

export async function sendEscrowReleasedEmail({ counterpartyUserId, jobId, amount, currency }) {
  const to = await getUserEmail(counterpartyUserId)
  if (!to) return { ok: false, reason: 'no_email' }
  const subject = `${APP_NAME} – Payment released`
  const text = `Your payment has been released (${currency || 'GHS'} ${amount ?? '—'}). It will be available in your wallet for payout.\n\nView job: ${process.env.APP_BASE_URL || 'https://locallink.agency'}/artisan/jobs/${jobId}`
  await sendEmail({ to, subject, text })
  return { ok: true }
}
