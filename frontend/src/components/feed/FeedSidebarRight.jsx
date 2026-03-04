import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'

export function FeedSidebarRight({ className = '' }) {
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [expandedEventId, setExpandedEventId] = useState(null)
  const [eventDetail, setEventDetail] = useState(null)
  const [rsvpBusy, setRsvpBusy] = useState(false)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)

  const loadEvents = useCallback(async () => {
    setEventsLoading(true)
    try {
      const res = await http.get('/events')
      setEvents(Array.isArray(res.data) ? res.data : [])
    } catch {
      setEvents([])
    } finally {
      setEventsLoading(false)
    }
  }, [])

  const loadNews = useCallback(async () => {
    setNewsLoading(true)
    try {
      const res = await http.get('/news', { params: { order: 'desc', limit: 12 } })
      setNews(Array.isArray(res.data) ? res.data : [])
    } catch {
      setNews([])
    } finally {
      setNewsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  useEffect(() => {
    loadNews()
  }, [loadNews])

  const fetchEventDetail = useCallback(async (id) => {
    if (!id) return
    try {
      const res = await http.get(`/events/${id}`)
      setEventDetail(res.data)
    } catch {
      setEventDetail(null)
    }
  }, [])

  const openEvent = useCallback((id) => {
    setExpandedEventId((prev) => (prev === id ? null : id))
    if (id) fetchEventDetail(id)
    else setEventDetail(null)
  }, [fetchEventDetail])

  const setRsvp = useCallback(async (eventId, status) => {
    setRsvpBusy(true)
    try {
      await http.post(`/events/${eventId}/rsvp`, { status })
      await fetchEventDetail(eventId)
      await loadEvents()
    } finally {
      setRsvpBusy(false)
    }
  }, [fetchEventDetail, loadEvents])

  const removeRsvp = useCallback(async (eventId) => {
    setRsvpBusy(true)
    try {
      await http.delete(`/events/${eventId}/rsvp`)
      await fetchEventDetail(eventId)
      await loadEvents()
    } finally {
      setRsvpBusy(false)
    }
  }, [fetchEventDetail, loadEvents])

  const formatEventDate = (d) => {
    if (!d) return ''
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return String(d)
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <aside className={`shrink-0 ${className}`}>
      <div className="sticky top-24 space-y-4">
        {/* Trending News */}
        <div className="rounded-2xl border border-stone-200/60 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/95">
          <div className="text-sm font-bold text-stone-900 dark:text-white">Trending News</div>
          {newsLoading ? (
            <div className="mt-3 flex items-center justify-center py-6 text-sm text-stone-500 dark:text-slate-400">Loading…</div>
          ) : news.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500 dark:text-slate-400">No news yet.</p>
          ) : (
            <div className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
              {news.map((n) => (
                <Link
                  key={n.id}
                  to={`/news/${encodeURIComponent(n.slug)}`}
                  className="flex gap-2 rounded-xl border border-stone-100 bg-stone-50/50 p-2 transition hover:bg-stone-100/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  {n.hero_image_url ? (
                    <img
                      src={n.hero_image_url.startsWith('http') ? `/api/news/image?src=${encodeURIComponent(n.hero_image_url)}` : n.hero_image_url}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-14 w-20 shrink-0 rounded-lg bg-stone-200 dark:bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="line-clamp-2 text-xs font-semibold text-stone-900 leading-tight dark:text-white">{n.title}</div>
                    <div className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                      {n.published_at ? formatEventDate(n.published_at) : ''}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Local Events */}
        <div className="rounded-2xl border border-stone-200/60 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black/95">
          <div className="text-sm font-bold text-stone-900 dark:text-white">Local Events</div>
          {eventsLoading ? (
            <div className="mt-3 flex items-center justify-center py-6 text-sm text-stone-500 dark:text-slate-400">Loading…</div>
          ) : events.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500 dark:text-slate-400">No upcoming events.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="overflow-hidden rounded-xl border border-stone-100 bg-stone-50/50 dark:border-white/10 dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => openEvent(ev.id)}
                    className="flex w-full gap-3 p-2 text-left transition hover:bg-stone-100/60 dark:hover:bg-white/10"
                  >
                    <img
                      src={ev.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=320&h=120&fit=crop'}
                      alt=""
                      className="h-16 w-20 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="text-xs font-semibold text-stone-900 leading-tight dark:text-white">{ev.title}</div>
                      <div className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">{formatEventDate(ev.starts_at)}</div>
                      {ev.company_name ? (
                        <div className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">by {ev.company_name}</div>
                      ) : null}
                    </div>
                    <span className="shrink-0 self-center text-stone-400 dark:text-slate-500">
                      {expandedEventId === ev.id ? '▼' : '▶'}
                    </span>
                  </button>
                  {expandedEventId === ev.id && (
                    <div className="border-t border-stone-100 px-3 py-3 dark:border-white/10">
                      {(eventDetail?.id === ev.id ? eventDetail : ev).description ? (
                        <p className="mb-3 text-xs text-stone-600 dark:text-slate-300">
                          {(eventDetail?.id === ev.id ? eventDetail : ev).description}
                        </p>
                      ) : null}
                      {(eventDetail?.id === ev.id ? eventDetail : ev).location ? (
                        <p className="mb-3 text-[11px] text-stone-500 dark:text-slate-400">
                          📍 {(eventDetail?.id === ev.id ? eventDetail : ev).location}
                        </p>
                      ) : null}
                      {eventDetail?.id === ev.id ? (
                        <>
                          <div className="mb-2 flex gap-2 text-[11px] text-stone-500 dark:text-slate-400">
                            <span>{eventDetail.going_count ?? 0} going</span>
                            <span>{eventDetail.interested_count ?? 0} interested</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={rsvpBusy}
                              onClick={() => setRsvp(ev.id, eventDetail.my_rsvp === 'going' ? 'interested' : 'going')}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                                eventDetail.my_rsvp === 'going'
                                  ? 'bg-brand-green text-white dark:bg-brand-green dark:text-white'
                                  : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'
                              }`}
                            >
                              {eventDetail.my_rsvp === 'going' ? '✓ Going' : 'Going'}
                            </button>
                            <button
                              type="button"
                              disabled={rsvpBusy}
                              onClick={() => (eventDetail.my_rsvp === 'interested' ? removeRsvp(ev.id) : setRsvp(ev.id, 'interested'))}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                                eventDetail.my_rsvp === 'interested'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                  : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-white/20 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15'
                              }`}
                            >
                              {eventDetail.my_rsvp === 'interested' ? '✓ Interested' : 'Interested'}
                            </button>
                            {eventDetail.my_rsvp ? (
                              <button
                                type="button"
                                disabled={rsvpBusy}
                                onClick={() => removeRsvp(ev.id)}
                                className="rounded-lg px-2 py-1.5 text-[11px] text-stone-500 hover:text-stone-700 dark:text-slate-400 dark:hover:text-slate-200"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-stone-500 dark:text-slate-400">Loading…</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
