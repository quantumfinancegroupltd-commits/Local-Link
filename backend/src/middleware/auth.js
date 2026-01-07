import { verifyToken } from '../auth/jwt.js'

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || ''
  const token = hdr.startsWith('Bearer ') ? hdr.slice('Bearer '.length) : null
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  try {
    const decoded = verifyToken(token)
    req.user = decoded
    return next()
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
    if (!allowed.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
    return next()
  }
}


