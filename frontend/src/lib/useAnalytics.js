import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const SESSION_KEY = 'analytics_session_id'

function getOrCreateSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
      sessionStorage.setItem(SESSION_KEY, id)
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

/** Call from anywhere to track a conversion event (signup, login, job_posted, order_placed). */
export function trackEvent(eventName) {
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
  const sessionIdRef = useRef(getOrCreateSessionId())
  const prevPathRef = useRef(null)

  useEffect(() => {
    const path = location.pathname || '/'
    if (prevPathRef.current === path) return
    prevPathRef.current = path
    const utm = getUtmFromSearch(location.search || '')
    trackPageView(path, document?.title, document?.referrer, sessionIdRef.current, utm)
  }, [location.pathname, location.search, location.key])
}
