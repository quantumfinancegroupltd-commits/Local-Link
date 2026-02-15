import { pool } from '../db/pool.js'

async function recordTrustEventForPolicyEvent(ev) {
  const kind = String(ev?.kind ?? '')
  const userId = ev?.user_id ?? null
  if (!userId || !kind) return

  // Map policy events into Trust V2 ledger (best-effort, idempotent via dedupe_key).
  const map = {
    phone_leak: { component: 'integrity', points: -8 },
    off_platform_link: { component: 'integrity', points: -6 },
    no_show: { component: 'reliability', points: -15 },
  }
  const m = map[kind]
  if (!m) return

  const dedupeKey = `policy:${String(ev.id)}`
  await pool.query(
    `insert into trust_events (user_id, actor_user_id, component, kind, points, meta, dedupe_key, occurred_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (user_id, dedupe_key) do nothing`,
    [userId, null, m.component, kind, m.points, ev.meta ?? null, dedupeKey, ev.created_at ?? new Date()],
  )
}

export function maskPhoneNumbers(text) {
  // Ghana + generic patterns (keep it simple; this is anti-leakage, not perfect parsing)
  // Examples:
  // +233XXXXXXXXX, 0XXXXXXXXX, 233XXXXXXXXX, and any 8+ digit runs with optional separators.
  const s = String(text ?? '')
  const phoneLike = /(\+?233|0)?[\s-]?\d[\d\s-]{6,}\d/g
  let changed = false
  const out = s.replace(phoneLike, (m) => {
    const digits = m.replace(/\D/g, '')
    if (digits.length < 8) return m
    changed = true
    // keep last 2 digits for context, mask the rest
    const masked = digits
      .split('')
      .map((ch, idx) => (idx < digits.length - 2 ? '•' : ch))
      .join('')
    return masked
  })
  return { text: out, changed }
}

export function maskOffPlatformLinks(text) {
  const s = String(text ?? '')
  const re = /(https?:\/\/)?(www\.)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com)\S*/gi
  let changed = false
  const out = s.replace(re, () => {
    changed = true
    return '[link removed]'
  })
  return { text: out, changed }
}

export function isOffPlatformUrl(url) {
  const u = String(url ?? '').toLowerCase()
  return u.includes('wa.me') || u.includes('whatsapp.com') || u.includes('api.whatsapp.com') || u.includes('chat.whatsapp.com')
}

export async function recordPolicyEvent({ userId, kind, contextType, contextId, meta }) {
  if (!kind) return null
  const r = await pool.query(
    `insert into policy_events (user_id, kind, context_type, context_id, meta)
     values ($1,$2,$3,$4,$5)
     returning *`,
    [userId ?? null, String(kind), contextType ?? null, contextId ?? null, meta ?? null],
  )
  const ev = r.rows[0]
  try {
    await recordTrustEventForPolicyEvent(ev)
  } catch {
    // best-effort: trust ledger should never block the main action
  }
  return ev
}


