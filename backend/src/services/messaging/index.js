/**
 * Transactional messaging (SMS, email, WhatsApp).
 * Set TERMII_API_KEY or TWILIO_* env vars to enable.
 * No-op when not configured.
 */
import { env } from '../../config.js'

let _termiiApiKey = null
let _twilioClient = null

function termiiApiKey() {
  if (_termiiApiKey !== null) return _termiiApiKey
  _termiiApiKey = (env.TERMII_API_KEY || '').trim() || null
  return _termiiApiKey
}

async function twilioClient() {
  if (_twilioClient !== null) return _twilioClient
  const sid = (env.TWILIO_ACCOUNT_SID || '').trim()
  const token = (env.TWILIO_AUTH_TOKEN || '').trim()
  if (!sid || !token) {
    _twilioClient = false
    return null
  }
  try {
    const twilioMod = await import('twilio')
    _twilioClient = twilioMod.default(sid, token)
    return _twilioClient
  } catch {
    _twilioClient = false
    return null
  }
}

/**
 * Send SMS via Termii (Ghana-focused) or Twilio.
 * @param {string} to - E.164 phone number (e.g. +233241234567)
 * @param {string} body - Message text
 * @param {string} [from] - Sender ID (Termii) or Twilio phone number
 * @returns {{ ok: boolean, provider?: string, error?: string }}
 */
export async function sendSms(to, body, from) {
  const phone = String(to || '').trim()
  const text = String(body || '').trim()
  if (!phone || !text) return { ok: false, error: 'Missing phone or body' }

  // Termii (Ghana)
  const termiiKey = termiiApiKey()
  if (termiiKey) {
    try {
      const senderId = (from || env.TERMII_SENDER_ID || 'LocalLink').slice(0, 11)
      const res = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone.replace(/^\+/, ''),
          from: senderId,
          sms: text,
          type: 'plain',
          api_key: termiiKey,
          channel: 'generic',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && (data?.message_id || data?.message === 'Successfully Sent')) {
        return { ok: true, provider: 'termii' }
      }
      return { ok: false, provider: 'termii', error: data?.message || data?.message_id || res.statusText }
    } catch (e) {
      return { ok: false, provider: 'termii', error: e?.message || String(e) }
    }
  }

  // Twilio
  const twilio = await twilioClient()
  if (twilio) {
    try {
      const fromNumber = from || env.TWILIO_PHONE_NUMBER
      if (!fromNumber) return { ok: false, error: 'TWILIO_PHONE_NUMBER not set' }
      await twilio.messages.create({
        body: text,
        from: fromNumber,
        to: phone,
      })
      return { ok: true, provider: 'twilio' }
    } catch (e) {
      return { ok: false, provider: 'twilio', error: e?.message || String(e) }
    }
  }

  // No provider configured - no-op (dev mode)
  return { ok: false, error: 'No SMS provider configured (TERMII_API_KEY or TWILIO_*)' }
}

/**
 * Send transactional notification (in-app + optional SMS/email).
 * Use for job quote received, quote accepted, order placed, etc.
 * @param {object} opts
 * @param {string} opts.userId - Target user ID
 * @param {string} opts.type - Notification type
 * @param {string} opts.title - Short title
 * @param {string} [opts.body] - Longer body
 * @param {string} [opts.phone] - Optional: send SMS too
 * @param {object} [opts.meta] - Optional meta
 * @param {string} [opts.dedupeKey] - Dedupe key
 */
export async function sendTransactional({ userId, type, title, body, phone, meta, dedupeKey }) {
  const { notify } = await import('../notifications.js')
  const row = await notify({ userId, type, title, body, meta, dedupeKey })
  if (phone && (termiiApiKey() || (await twilioClient()))) {
    const msg = body ? `${title}\n\n${body}`.slice(0, 160) : title
    await sendSms(phone, msg).catch(() => {})
  }
  return row
}

/**
 * In-app notification + optional SMS (fetches user phone).
 * Use for quote received, quote accepted, order placed, delivery assigned, dispute opened.
 */
export async function notifyWithSms(userId, { type, title, body, meta, dedupeKey }) {
  if (!userId) return null
  const { pool } = await import('../db/pool.js')
  const r = await pool.query('select phone from users where id = $1 limit 1', [userId])
  const phone = r.rows[0]?.phone ? String(r.rows[0].phone).trim() : null
  return sendTransactional({ userId, type, title, body, phone: phone || undefined, meta, dedupeKey })
}
