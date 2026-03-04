import jwt from 'jsonwebtoken'
import { env } from '../config.js'

export function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' })
}

export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET)
}
