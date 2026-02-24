/**
 * Simple first-party cookie helpers for analytics consent and session.
 * Used for admin web traffic analytics and GDPR-friendly consent.
 */

const COOKIE_MAX_AGE_DAYS = 365

export const ANALYTICS_CONSENT_KEY = 'locallink_analytics_consent'
export const ANALYTICS_SESSION_KEY = 'locallink_analytics_session'

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$1') + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]).trim() : null
}

function setCookie(name, value, days = COOKIE_MAX_AGE_DAYS) {
  if (typeof document === 'undefined') return
  const maxAge = days * 24 * 60 * 60
  const sameSite = 'Lax'
  const secure = window.location?.protocol === 'https:'
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=${sameSite}${secure ? '; Secure' : ''}`
}

export function getAnalyticsConsent() {
  const v = getCookie(ANALYTICS_CONSENT_KEY)
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return null // not set yet
}

export function setAnalyticsConsent(accepted) {
  setCookie(ANALYTICS_CONSENT_KEY, accepted ? 'true' : 'false')
}

export function getAnalyticsSessionId() {
  return getCookie(ANALYTICS_SESSION_KEY)
}

export function setAnalyticsSessionId(id) {
  setCookie(ANALYTICS_SESSION_KEY, id)
}
