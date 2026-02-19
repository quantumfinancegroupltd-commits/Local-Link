import jwt from 'jsonwebtoken'
import { env } from '../config.js'

// 30 days so users aren’t logged out while editing profile/services (was 7d).
export function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET)
}


