import nodemailer from 'nodemailer'
import { env } from '../config.js'

let cached = null

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM)
}

function getTransporter() {
  if (cached) return cached
  if (!hasSmtpConfig()) return null
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Boolean(env.SMTP_SECURE),
    auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  return cached
}

export async function sendEmail({ to, subject, text, html }) {
  const safeTo = String(to || '').trim()
  if (!safeTo) return { ok: false, skipped: true, reason: 'missing_to' }

  const safeSubject = String(subject || '').trim()
  const safeText = text != null ? String(text) : ''
  const safeHtml = html != null ? String(html) : undefined

  const transport = getTransporter()
  if (!transport) {
    // In dev we still want to "send" by logging.
    // eslint-disable-next-line no-console
    if (env.NODE_ENV !== 'production') console.log('[mailer] SMTP not configured. Email would have been sent to:', safeTo, 'subject:', safeSubject)
    // eslint-disable-next-line no-console
    if (env.NODE_ENV !== 'production') console.log('[mailer] text:\n', safeText)
    return { ok: false, skipped: true, reason: 'smtp_not_configured' }
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: safeTo,
      subject: safeSubject,
      text: safeText,
      html: safeHtml,
    })
    return { ok: true }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[mailer] send failed:', e?.message ?? e)
    return { ok: false, error: e?.message ?? 'send_failed' }
  }
}

