import { env } from '../config.js'

// Provider handlers should be:
// - idempotent (safe to retry)
// - deterministic
// - return { outcome: 'processed'|'ignored', note?: string }
export async function handleWebhook(provider, payload) {
  const p = String(provider || '').toLowerCase()

  if (p === 'flutterwave') {
    // We intentionally do NOT implement Flutterwave mapping yet (external/provider integration).
    // For now: acknowledge receipt, store payload, and mark as ignored so it doesn't retry forever.
    if (!env.FLUTTERWAVE_WEBHOOK_HASH) {
      return { outcome: 'ignored', note: 'FLUTTERWAVE_WEBHOOK_HASH not configured' }
    }
    return { outcome: 'ignored', note: 'Flutterwave mapping not implemented yet' }
  }

  return { outcome: 'ignored', note: `No handler for provider '${p}'` }
}


