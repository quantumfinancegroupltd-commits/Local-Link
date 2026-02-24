/**
 * Lightweight intent detection for YAO assistant.
 * Maps user message to PAYMENT | DISPUTE | HIRING | DELIVERY | ACCOUNT | LISTINGS | ADMIN_OPS | GENERAL
 * so we can route to the right knowledge, actions, and (later) live data.
 */

const INTENT_KEYWORDS = {
  PAYMENT: [
    'refund', 'payment', 'pay', 'paid', 'withdraw', 'withdrawal', 'escrow', 'release', 'payout',
    'money', 'fee', 'charge', 'balance', 'wallet', 'mobile money', 'bank', 'get paid', 'when do i get paid',
  ],
  DISPUTE: [
    'complaint', 'complaints', 'fraud', 'scam', 'cancel', 'cancellation', 'issue', 'problem', 'wrong',
    'dispute', 'disputes', 'report', 'reporting', 'not satisfied', 'refund request', 'bad experience',
  ],
  HIRING: [
    'hire', 'hiring', 'find a', 'looking for', 'need a', 'need an', 'plumber', 'cleaner', 'carpenter',
    'post a job', 'post job', 'quote', 'quotes', 'applicant', 'applicants', 'job board', 'jobs board',
    'worker', 'artisan', 'provider', 'get someone', 'book', 'booking',
  ],
  DELIVERY: [
    'delivery', 'deliveries', 'track', 'tracking', 'where is my order', 'order status', 'driver',
    'on the way', 'shipping', 'claim delivery', 'claim deliveries',
  ],
  ACCOUNT: [
    'verify', 'verification', 'verified', 'profile', 'account', 'id', 'ghana card', 'bronze', 'silver', 'gold',
    'tier', 'withdraw', 'kyc', 'change password', 'email', 'phone number',
  ],
  LISTINGS: [
    'list', 'listing', 'listings', 'my services', 'my produce', 'add service', 'add product',
    'visibility', 'bookings', 'get more', 'promote', 'boost', 'profile photo', 'photos',
  ],
  ADMIN_OPS: [
    'stuck escrow', 'stuck escrows', 'disputes older', 'suspicious', 'flag user', 'admin',
    'resolve dispute', 'metrics', 'user list', 'support tickets',
  ],
}

function normalize(text) {
  return String(text || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * @param {string} message - Current user message
 * @param {string} [lastUserMessage] - Previous user message (for context)
 * @returns {{ intent: string, confidence: 'high'|'low'|'none' }}
 */
export function detectIntent(message, lastUserMessage = '') {
  const combined = `${normalize(lastUserMessage)} ${normalize(message)}`.trim()
  if (!combined) return { intent: 'GENERAL', confidence: 'none' }

  const words = combined.split(/\s+/)
  let bestIntent = 'GENERAL'
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (combined.includes(kw)) score += 2
      if (words.some((w) => w === kw || w.startsWith(kw) || kw.startsWith(w))) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent
    }
  }

  const confidence = bestScore >= 2 ? 'high' : bestScore === 1 ? 'low' : 'none'
  return { intent: bestIntent, confidence }
}

/**
 * Short guidance for the system prompt based on intent (so YAO stays consistent).
 * @param {string} intent
 * @returns {string}
 */
export function getIntentGuidance(intent) {
  const map = {
    DISPUTE: 'User intent appears to be a complaint or dispute. Acknowledge their concern and suggest opening a support ticket for resolution. Do not promise to resolve it yourself.',
    PAYMENT: 'User is asking about payments, escrow, or withdrawals. Use platform knowledge on escrow and payouts; point to wallet/withdrawals where relevant.',
    HIRING: 'User wants to hire or post a job. Suggest Find providers, Post a job, or Jobs board as appropriate.',
    DELIVERY: 'User is asking about delivery or order status. Suggest My orders or driver flows; if we add live data later, use it here.',
    ACCOUNT: 'User is asking about verification, profile, or account. Point to Verification and profile settings.',
    LISTINGS: 'User is asking about listings, services, or visibility. For providers, suggest improving profile and My services.',
    ADMIN_OPS: 'User is admin and asking about operations. Suggest Admin dashboard for disputes, metrics, and support tickets.',
  }
  return map[intent] || ''
}

/**
 * Intent-specific suggested actions (deep links) to merge with role-based ones.
 * @param {string} intent
 * @param {string} userRole
 * @returns {{ label: string, url: string }[]}
 */
export function getIntentActions(intent, userRole) {
  const actions = []
  if (intent === 'DISPUTE') {
    actions.push({ label: 'Open a support ticket', url: '/support' })
  }
  if (intent === 'PAYMENT' && (userRole === 'artisan' || userRole === 'farmer' || userRole === 'driver')) {
    actions.push({ label: 'Withdrawals & wallet', url: '/profile?tab=settings' })
  }
  if (intent === 'HIRING' && userRole === 'buyer') {
    actions.push({ label: 'Post a job', url: '/buyer/jobs/new' })
  }
  if (intent === 'DELIVERY' && userRole === 'buyer') {
    actions.push({ label: 'My orders', url: '/buyer/orders' })
  }
  if (intent === 'ACCOUNT') {
    actions.push({ label: 'Verification', url: '/trust/verification' })
  }
  if (intent === 'LISTINGS' && (userRole === 'artisan' || userRole === 'farmer')) {
    actions.push({ label: 'My services', url: userRole === 'artisan' ? '/artisan/services' : '/farmer' })
  }
  if (intent === 'ADMIN_OPS' && userRole === 'admin') {
    actions.push({ label: 'Admin dashboard', url: '/admin' })
  }
  return actions
}
