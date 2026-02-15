import { Button, Card } from '../ui/FormControls.jsx'

function fmtDate(ts) {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (!Number.isFinite(d.getTime())) return ''
    return d.toLocaleDateString()
  } catch {
    return ''
  }
}

function labelForRole(role) {
  const r = String(role || '').toLowerCase()
  if (r === 'artisan') return 'jobs'
  if (r === 'farmer') return 'orders'
  if (r === 'driver') return 'deliveries'
  return 'items'
}

function OutcomePill({ outcome }) {
  const o = String(outcome || 'completed')
  if (o === 'issue_resolved') {
    return <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Issue resolved</span>
  }
  if (o === 'issue_open') {
    return <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Had an issue</span>
  }
  return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Completed</span>
}

export function WorkHistoryCard({ loading, error, data, onLoadMore, loadMoreBusy = false, compact = false }) {
  const summary = data?.summary ?? null
  const items = Array.isArray(data?.items) ? data.items : []
  const hasMore = !!data?.has_more

  const since = summary?.since ? fmtDate(summary.since) : null
  const completedTotal = Number(summary?.completed_total ?? 0)
  const completed90d = Number(summary?.completed_90d ?? 0)
  const roleLabel = labelForRole(summary?.role)

  return (
    <Card className={compact ? 'p-4' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Verified work history</div>
          <div className="mt-1 text-xs text-slate-600">Auto-built from completed transactions. Not editable.</div>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-slate-600">Loading…</div>
      ) : error ? (
        <div className="mt-3 text-sm text-red-700">{error}</div>
      ) : (
        <>
          <div className="mt-3 rounded-2xl border bg-slate-50 p-3">
            <div className="text-sm font-semibold text-slate-900">
              {completedTotal} {roleLabel} completed{since ? ` since ${since}` : ''}
            </div>
            <div className="mt-1 text-xs text-slate-600">{completed90d} completed in the last 90 days</div>
            {Array.isArray(summary?.top_categories) && summary.top_categories.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {summary.top_categories.slice(0, 6).map((c) => (
                  <span key={c.category} className="rounded-full border bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {c.category} • {Number(c.count ?? 0)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {items.length ? (
            <div className="mt-3 divide-y rounded-2xl border bg-white">
              {items.map((it) => (
                <div key={`${it.context_type}:${it.context_id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{it.title || 'Completed'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        {it.category ? <span className="rounded-full border bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">{it.category}</span> : null}
                        {it.location ? <span className="truncate">• {it.location}</span> : null}
                        {it.occurred_at ? <span className="truncate">• {fmtDate(it.occurred_at)}</span> : null}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <OutcomePill outcome={it.outcome} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600">No completed history yet.</div>
          )}

          {hasMore ? (
            <div className="mt-3">
              <Button variant="secondary" onClick={onLoadMore} disabled={loadMoreBusy}>
                {loadMoreBusy ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  )
}

