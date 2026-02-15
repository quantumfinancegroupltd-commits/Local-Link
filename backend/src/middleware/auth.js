import { verifyToken } from '../auth/jwt.js'
import { markActive } from '../services/activity.js'
import { pool } from '../db/pool.js'

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    // Track activity for matching/ranking (best-effort).
    markActive(decoded?.sub)
    // Enforce soft-deletes immediately (prevents deleted users using still-valid JWTs).
    pool
      .query('select deleted_at, suspended_until, suspended_reason from users where id = $1', [decoded?.sub])
      .then((r) => {
        const row = r.rows[0]
        if (!row) return res.status(401).json({ message: 'Unauthorized' })
        if (row.deleted_at) return res.status(403).json({ message: 'Account is deleted' })
        if (row.suspended_until && new Date(row.suspended_until).getTime() > Date.now()) {
          return res.status(403).json({
            message: 'Account temporarily suspended',
            suspended_until: row.suspended_until,
            reason: row.suspended_reason ?? null,
          })
        }
        return next()
      })
      .catch(() => res.status(401).json({ message: 'Unauthorized' }))
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

// Optional auth: if a valid token is present we attach req.user; otherwise continue unauthenticated.
// Useful for public pages that personalize a little (e.g., viewer_liked) but don't require login.
export function optionalAuth(req, _res, next) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : null
  if (!token) return next()
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    markActive(decoded?.sub)
    // Best-effort: if the account is deleted, treat request as unauthenticated.
    pool
      .query('select deleted_at, suspended_until from users where id = $1', [decoded?.sub])
      .then((r) => {
        const row = r.rows[0]
        if (row?.deleted_at) delete req.user
        if (row?.suspended_until && new Date(row.suspended_until).getTime() > Date.now()) delete req.user
        return next()
      })
      .catch(() => next())
    return
  } catch {
    // ignore invalid tokens for public endpoints
  }
  return next()
}

export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (!allowed.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    return next()
  }
}

// Require that the authenticated user is ID-verified (Ghana Card flow) before performing paid provider actions.
// By default, only gates provider roles.
export function requireIdVerified({ roles = ['artisan', 'farmer', 'driver'] } = {}) {
  const gated = Array.isArray(roles) ? roles : [roles]
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (!gated.includes(req.user.role)) return next()
    pool
      .query('select id_verified from users where id = $1', [req.user.sub])
      .then((r) => {
        const ok = !!r.rows[0]?.id_verified
        if (!ok) {
          return res.status(403).json({
            message: 'ID verification required to use this feature.',
            code: 'ID_VERIFICATION_REQUIRED',
          })
        }
        return next()
      })
      .catch(() =>
        res.status(500).json({
          message: 'Failed to verify account status',
        }),
      )
  }
}


