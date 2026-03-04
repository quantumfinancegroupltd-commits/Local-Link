import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { http } from '../api/http.js'

const COOKIE_NAME = 'locallink_ref'
const COOKIE_DAYS = 30

function setReferralCookie(code) {
  try {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${COOKIE_DAYS * 24 * 60 * 60}; samesite=lax; ${document.location?.protocol === 'https:' ? 'secure;' : ''}`
  } catch {
    /* ignore */
  }
}

export function getReferralFromCookie() {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

/** Call from a component inside Router; records ref click when ?ref= is in URL and sets cookie */
export function useReferralTracking() {
  const location = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const ref = params.get('ref') || params.get('referral')
    if (!ref || !ref.trim()) return

    const code = String(ref).trim()
    setReferralCookie(code)
    http.post('/affiliates/record-click', { ref: code }).catch(() => {})
  }, [location.search])
}
