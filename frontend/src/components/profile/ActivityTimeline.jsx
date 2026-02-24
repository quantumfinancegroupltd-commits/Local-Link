import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../ui/FormControls.jsx'

const LIMIT = 30

function formatDate(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!Number.isFinite(d.getTime())) return ''
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return ''
  }
}

function typeIcon(type) {
  const base = 'h-5 w-5 flex-shrink-0'
  switch (type) {
    case 'order':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      )
    case 'job':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    case 'quote':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'review':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      )
    case 'escrow':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'dispute':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    case 'job_post':
    case 'application':
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    default:
      return (
        <svg className={base} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

function typeColor(type) {
  switch (type) {
    case 'order':
      return 'bg-emerald-100 text-emerald-800'
    case 'job':
      return 'bg-slate-100 text-slate-800'
    case 'quote':
      return 'bg-blue-100 text-blue-800'
    case 'review':
      return 'bg-amber-100 text-amber-800'
    case 'escrow':
      return 'bg-violet-100 text-violet-800'
    case 'dispute':
      return 'bg-red-100 text-red-800'
    case 'job_post':
    case 'application':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function ActivityTimeline({ userId = null, className = '' }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  async function load(append = false, before = null) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(LIMIT))
      if (before) params.set('before', before)
      if (userId) params.set('user_id', userId)
      const res = await http.get(`/timeline?${params.toString()}`)
      const list = Array.isArray(res?.data?.events) ? res.data.events : []
      if (append) {
        setEvents((prev) => [...prev, ...list])
      } else {
        setEvents(list)
      }
      setHasMore(list.length >= LIMIT)
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load activity')
      if (!append) setEvents([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    load(false, null)
  }, [userId])

  function loadMore() {
    if (events.length === 0 || loadingMore || !hasMore) return
    const lastAt = events[events.length - 1]?.at
    if (!lastAt) return
    load(true, lastAt)
  }

  return (
    <Card className={className}>
      <div className="text-sm font-semibold text-slate-900">Activity</div>
      <div className="mt-1 text-xs text-slate-600">Orders, jobs, quotes, reviews, payments and disputes in one place.</div>

      {loading && events.length === 0 ? (
        <div className="mt-4 text-sm text-slate-600">Loading…</div>
      ) : error && events.length === 0 ? (
        <div className="mt-4 text-sm text-red-700">{error}</div>
      ) : events.length === 0 ? (
        <div className="mt-4 text-sm text-slate-600">No activity yet. Your orders, jobs and reviews will appear here.</div>
      ) : (
        <ul className="mt-4 divide-y border-t border-slate-200">
          {events.map((ev) => (
            <li key={`${ev.type}:${ev.id}`} className="flex gap-3 py-4 first:pt-4">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${typeColor(ev.type)}`}>
                {typeIcon(ev.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{ev.title}</span>
                  <span className="text-xs text-slate-500">{formatDate(ev.at)}</span>
                </div>
                {ev.summary ? <div className="mt-0.5 text-sm text-slate-600">{ev.summary}</div> : null}
                {ev.link ? (
                  <Link to={ev.link} className="mt-1.5 inline-block text-sm font-medium text-emerald-700 hover:underline">
                    View details →
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore && events.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </Card>
  )
}
