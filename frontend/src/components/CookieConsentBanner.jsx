import { useState, useEffect } from 'react'
import { getAnalyticsConsent, setAnalyticsConsent, setAnalyticsSessionId } from '../lib/cookies.js'

function generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = getAnalyticsConsent()
    if (consent === null) setVisible(true)
    else setVisible(false)
  }, [])

  const accept = () => {
    setAnalyticsConsent(true)
    const id = generateSessionId()
    setAnalyticsSessionId(id)
    setVisible(false)
    // Trigger one page view now so admin analytics gets this session
    try {
      const base = String(import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
      const url = base.endsWith('/api') ? `${base}/analytics/track` : `${base}/api/analytics/track`
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'page_view',
          path: typeof window !== 'undefined' ? window.location.pathname : '/',
          title: typeof document !== 'undefined' ? document.title : null,
          referrer: typeof document !== 'undefined' ? document.referrer : null,
          session_id: id,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch (_) {}
  }

  const decline = () => {
    setAnalyticsConsent(false)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-slate-200 bg-white p-4 shadow-lg sm:px-6"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          We use cookies for analytics and to improve LocalLink (e.g. page views, traffic sources). No ads or third-party tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={decline}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
