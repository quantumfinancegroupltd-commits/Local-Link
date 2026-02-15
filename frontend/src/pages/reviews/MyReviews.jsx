import { useEffect, useState } from 'react'
import { http } from '../../api/http.js'
import { Card } from '../../components/ui/FormControls.jsx'

export function MyReviews() {
  const [summary, setSummary] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [s, r] = await Promise.all([http.get('/reviews/summary/me'), http.get('/reviews/me')])
        if (cancelled) return
        setSummary(s.data ?? null)
        setReviews(Array.isArray(r.data) ? r.data : [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load reviews')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My reviews</h1>
        <p className="text-sm text-slate-600">Your reputation affects trust and visibility.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="text-xs text-slate-600">Average rating</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{loading ? '—' : (summary?.avg ?? 0).toFixed(1)}</div>
          <div className="mt-1 text-xs text-slate-600">{loading ? '' : `${summary?.count ?? 0} reviews`}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-600">Tips</div>
          <div className="mt-2 text-sm text-slate-700">
            Reply fast, be clear, and take photos of completed work/deliveries to reduce disputes.
          </div>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-700">{error}</div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-slate-600">No reviews yet.</div>
        ) : (
          <div className="divide-y">
            {reviews.map((r) => (
              <div key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">
                      {r.rating} ★ • {r.reviewer_name || 'User'} ({r.reviewer_role || '—'})
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.job_id || r.order_id ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          Verified transaction
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          Unverified
                        </span>
                      )}
                      {r.job_id ? (
                        <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Job {String(r.job_id).slice(0, 8)}
                        </span>
                      ) : r.order_id ? (
                        <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Order {String(r.order_id).slice(0, 8)}
                        </span>
                      ) : null}
                    </div>
                    {r.comment ? <div className="mt-2 text-sm text-slate-700">{r.comment}</div> : null}
                    <div className="mt-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}


