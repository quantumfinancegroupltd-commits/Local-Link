import crypto from 'node:crypto'
import { env } from '../config.js'

export function paystackSecretKey() {
  // Backward compatible: previously used PAYSTACK_WEBHOOK_SECRET
  return env.PAYSTACK_SECRET_KEY || env.PAYSTACK_WEBHOOK_SECRET || null
}

export function makePaystackReference(prefix = 'll') {
  return `${prefix}_${crypto.randomUUID()}`
}

export function toMinor(amountGhs) {
  // Paystack expects amount in pesewas (GHS * 100)
  return Math.round(Number(amountGhs) * 100)
}

export async function paystackInitializeTransaction({ email, amountGhs, reference, metadata, callbackUrl }) {
  const secret = paystackSecretKey()
  if (!secret) {
    const e = new Error('PAYSTACK_SECRET_KEY not set')
    e.code = 'PAYSTACK_NOT_CONFIGURED'
    throw e
  }

  const body = {
    email,
    amount: toMinor(amountGhs),
    reference,
    metadata: metadata ?? undefined,
    callback_url: callbackUrl ?? undefined,
    currency: 'GHS',
  }

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.message || `Paystack initialize failed (${res.status})`
    const e = new Error(msg)
    e.code = 'PAYSTACK_INIT_FAILED'
    e.details = json
    throw e
  }

  return json
}

export async function paystackVerifyTransaction(reference) {
  const secret = paystackSecretKey()
  if (!secret) {
    const e = new Error('PAYSTACK_SECRET_KEY not set')
    e.code = 'PAYSTACK_NOT_CONFIGURED'
    throw e
  }
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.message || `Paystack verify failed (${res.status})`
    const e = new Error(msg)
    e.code = 'PAYSTACK_VERIFY_FAILED'
    e.details = json
    throw e
  }
  return json
}


