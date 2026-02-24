import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getAnalyticsConsent,
  getAnalyticsSessionId,
  setAnalyticsSessionId,
} from './cookies.js'

const SESSION_STORAGE_KEY = 'analytics_session_id'

function getOrCreateSessionId() {
  // Prefer cookie (set after consent) for persistent session across visits
  const fromCookie = getAnalyticsSessionId()
  if (fromCookie) return fromCookie
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      sessionStorage.setItem(SESSION_STORAGE_KEY, id)
      if (getAnalyticsConsent()) setAnalyticsSessionId(id)
    }
    return id
  } catch {
    return `sess_${Date.now()}`
  }
}

function getUtmFromSearch(search) {
  if (!search || typeof search !== 'string') return {}
  const params = new URLSearchParams(search)
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
  }
}

function sendTrack(payload) {
  try {
    const base = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
    const url = base.endsWith('/api') ? `${base}/analytics/track` : `${base}/api/analytics/track`
    const token = localStorage.getItem('locallink_token')
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

function trackPageView(path, title, referrer, sessionId, utm = {}) {
  const payload = {
    event: 'page_view',
    path: path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    title: title || (typeof document !== 'undefined' ? document.title : null),
    referrer: referrer || (typeof document !== 'undefined' ? document.referrer : null),
    session_id: sessionId,
    ...utm,
  }
  sendTrack(payload)
}

/** Call from anywhere to track a conversion event (signup, login, job_posted, order_placed). Only sent when analytics consent is given. */
export function trackEvent(eventName) {
  if (typeof window !== 'undefined' && getAnalyticsConsent() !== true) return
  const sessionId = getOrCreateSessionId()
  sendTrack({
    event: eventName,
    session_id: sessionId,
    path: typeof window !== 'undefined' ? window.location.pathname : null,
    title: typeof document !== 'undefined' ? document.title : null,
    ...getUtmFromSearch(typeof window !== 'undefined' ? window.location.search : ''),
  })
}

export function useAnalytics() {
  const location = useLocation()
  const prevPathRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const consent = getAnalyticsConsent()
    if (consent !== true) return
    const path = location.pathname || '/'
    if (prevPathRef.current === path) return
    prevPathRef.current = path
    const sessionId = getOrCreateSessionId()
    const utm = getUtmFromSearch(location.search || '')
    trackPageView(path, document?.title, document?.referrer, sessionId, utm)
  }, [location.pathname, location.search, location.key])
}
