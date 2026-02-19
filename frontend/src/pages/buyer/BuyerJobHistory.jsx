import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'

const CURRENCY = 'GHS'

function formatMoney(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${CURRENCY} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

export function BuyerJobHistory() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/buyer/job-history')
        if (!cancelled) setData(res.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load history')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order history" subtitle="Spend on completed jobs." />
        <Card><div className="text-sm text-slate-600">Loading…</div></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Order history" subtitle="Spend on completed jobs." />
        <Card><div className="text-sm text-red-700">{error}</div></Card>
      </div>
    )
  }

  const orders = data?.orders ?? []
  const summary = data?.summary ?? {}
  const totalSpend = summary.total_spend ?? 0
  const thisMonth = summary.this_month ?? 0
  const byCategory = summary.by_category ?? []
  const byProvider = summary.by_provider ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order history"
        subtitle="How much you’ve spent on completed jobs, by category and provider."
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No completed jobs yet"
          description="When you complete jobs and release payment, they’ll appear here with spend totals."
          actions={
            <Link to="/buyer/jobs">
              <Button variant="secondary">View my jobs</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-slate-200 bg-slate-50/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total spend</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(totalSpend)}</div>
              <div className="mt-0.5 text-xs text-slate-600">All time</div>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">This month</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(thisMonth)}</div>
              <div className="mt-0.5 text-xs text-slate-600">{new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed jobs</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{orders.length}</div>
              <div className="mt-0.5 text-xs text-slate-600">With payment</div>
            </Card>
            <Card className="border-slate-200 bg-slate-50/50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Providers used</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{byProvider.length}</div>
              <div className="mt-0.5 text-xs text-slate-600">Unique</div>
            </Card>
          </div>

          {(byCategory.length > 0 || byProvider.length > 0) ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {byCategory.length > 0 ? (
                <Card>
                  <div className="text-sm font-semibold text-slate-900">Spend by category</div>
                  <ul className="mt-3 space-y-2">
                    {byCategory.slice(0, 8).map((c) => (
                      <li key={c.category} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{c.category}</span>
                        <span className="font-medium text-slate-900">{formatMoney(c.total)}</span>
                        <span className="text-xs text-slate-500">({c.count})</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
              {byProvider.length > 0 ? (
                <Card>
                  <div className="text-sm font-semibold text-slate-900">Spend by provider</div>
                  <ul className="mt-3 space-y-2">
                    {byProvider.slice(0, 8).map((p, i) => (
                      <li key={p.provider_user_id ?? `provider-${i}`} className="flex items-center justify-between text-sm">
                        <span className="truncate text-slate-700">{p.provider_name}</span>
                        <span className="ml-2 shrink-0 font-medium text-slate-900">{formatMoney(p.total)}</span>
                        <span className="ml-1 text-xs text-slate-500">({p.count})</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
          ) : null}

          <Card className="p-0">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Completed jobs</div>
              <div className="text-xs text-slate-500">Click a row to open the job.</div>
            </div>
            <div className="divide-y divide-slate-100">
              {orders.map((o) => (
                <Link
                  key={o.job_id}
                  to={`/buyer/jobs/${o.job_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{o.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      {o.category ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">{o.category}</span>
                      ) : null}
                      {o.provider_name ? (
                        <span>{o.provider_name}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <span className="font-semibold text-slate-900">{formatMoney(o.amount)}</span>
                    <span className="text-slate-500">{formatDate(o.completed_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
