import test from 'node:test'
import assert from 'node:assert/strict'
import { maskPhoneNumbers } from '../src/services/policy.js'

test('maskPhoneNumbers masks phone-like digit runs', () => {
  const input = 'Call me on 0551234567 or +233 55 123 4567'
  const r = maskPhoneNumbers(input)
  assert.equal(r.changed, true)
  assert.ok(!r.text.includes('0551234567'))
  assert.ok(!r.text.includes('+233 55 123 4567'))
})

test('maskPhoneNumbers leaves non-phone text unchanged', () => {
  const input = 'Hello there'
  const r = maskPhoneNumbers(input)
  assert.equal(r.changed, false)
  assert.equal(r.text, input)
})


