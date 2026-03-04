import { verifyToken } from '../auth/jwt.js'
import { markActive } from '../services/activity.js'
import { pool } from '../db/pool.js'

export async function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    markActive(decoded?.sub)

    const { rows } = await pool.query(
      'select deleted_at, suspended_until, suspended_reason from users where id = $1',
      [decoded?.sub],
    )
    const row = rows[0]
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
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

export async function optionalAuth(req, _res, next) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : null
  if (!token) return next()
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    markActive(decoded?.sub)

    const { rows } = await pool.query(
      'select deleted_at, suspended_until from users where id = $1',
      [decoded?.sub],
    )
    const row = rows[0]
    if (row?.deleted_at) delete req.user
    if (row?.suspended_until && new Date(row.suspended_until).getTime() > Date.now()) delete req.user
  } catch {
    // invalid tokens on public endpoints — treat as unauthenticated
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

export function requireIdVerified({ roles = ['artisan', 'farmer', 'driver'] } = {}) {
  const gated = Array.isArray(roles) ? roles : [roles]
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (!gated.includes(req.user.role)) return next()
    try {
      const { rows } = await pool.query('select id_verified from users where id = $1', [req.user.sub])
      if (!rows[0]?.id_verified) {
        return res.status(403).json({
          message: 'ID verification required to use this feature.',
          code: 'ID_VERIFICATION_REQUIRED',
        })
      }
      return next()
    } catch {
      return res.status(500).json({ message: 'Failed to verify account status' })
    }
  }
}
