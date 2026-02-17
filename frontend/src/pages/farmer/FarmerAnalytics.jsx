import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'

export function FarmerAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/farmers/me/analytics')
        if (!cancelled) setData(res.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load analytics')
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
        <PageHeader title="Analytics" subtitle="Your orders and listings at a glance" />
        <Card><div className="text-sm text-slate-600">Loading…</div></Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" subtitle="Your orders and listings at a glance" />
        <Card><div className="text-sm text-red-700">{error}</div></Card>
      </div>
    )
  }

  const d = data ?? {}
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Orders delivered, earnings, and listing health"
        actions={
          <Link to="/farmer">
            <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Back to dashboard
            </button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders delivered</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{Number(d.orders_delivered ?? 0).toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-600">Total orders completed</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wallet balance</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">GHS {Number(d.wallet_balance ?? 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-600">Available to withdraw</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total earnings</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">GHS {Number(d.earnings_total ?? 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-600">All-time from order releases</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active listings</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{Number(d.products_count ?? 0).toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-600">Products you have listed</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Out of stock</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{Number(d.out_of_stock_count ?? 0).toLocaleString()}</div>
          <div className="mt-1 text-xs text-slate-600">Listings needing restock</div>
        </Card>
      </div>
    </div>
  )
}
