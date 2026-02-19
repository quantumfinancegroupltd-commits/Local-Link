import test from 'node:test'
import assert from 'node:assert/strict'
import { signToken, verifyToken } from '../src/auth/jwt.js'

test('signToken and verifyToken roundtrip', () => {
  const payload = { sub: 'user-123', role: 'buyer' }
  const token = signToken(payload)
  assert.ok(typeof token === 'string' && token.length > 0)
  const decoded = verifyToken(token)
  assert.equal(decoded.sub, payload.sub)
  assert.equal(decoded.role, payload.role)
  assert.ok(decoded.exp && decoded.iat)
})

test('verifyToken throws on invalid token', () => {
  assert.throws(() => verifyToken('not-a-valid-jwt'), /jwt malformed|invalid token/i)
})
