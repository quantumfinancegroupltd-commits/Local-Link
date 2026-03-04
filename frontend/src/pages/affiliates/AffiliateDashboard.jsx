import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { SimpleLineChart } from '../../components/ui/SimpleLineChart.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { http } from '../../api/http.js'

const TIER_LABELS = { 1: '7%', 2: '10%', 3: '15%' }

export function AffiliateDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState(null)
  const [chartDays, setChartDays] = useState(30)
  const [promoCode, setPromoCode] = useState('')
  const [promoDesc, setPromoDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('momo')
  const [requestingPayout, setRequestingPayout] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    http
      .get('/affiliates/dashboard')
      .then((res) => {
        if (!cancelled) setData(res.data)
      })
      .catch((err) => {
        if (!cancelled && err?.response?.status === 403) setData({ approved: false })
        else if (!cancelled) toast.error(err?.response?.data?.message || 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [toast])

  useEffect(() => {
    if (!data?.approved) return
    let cancelled = false
    http
      .get('/affiliates/analytics', { params: { days: chartDays } })
      .then((res) => {
        if (!cancelled) setAnalytics(res.data)
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null)
      })
    return () => { cancelled = true }
  }, [data?.approved, chartDays])

  const handleCreatePromo = async (e) => {
    e.preventDefault()
    const code = promoCode.trim().toUpperCase().replace(/\s/g, '_')
    if (!code) {
      toast.error('Enter a code name')
      return
    }
    setCreating(true)
    try {
      const res = await http.post('/affiliates/promo-codes', { code, description: promoDesc.trim() || null })
      toast.success('Promo code created')
      setPromoCode('')
      setPromoDesc('')
      setData((prev) => ({
        ...prev,
        promo_codes: [res.data, ...(prev?.promo_codes ?? [])],
      }))
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create code')
    } finally {
      setCreating(false)
    }
  }

  const handleRequestPayout = async (e) => {
    e.preventDefault()
    const amount = Number(payoutAmount)
    if (!Number.isFinite(amount) || amount < 50) {
      toast.error('Minimum payout is $50')
      return
    }
    setRequestingPayout(true)
    try {
      await http.post('/affiliates/request-payout', { amount, method: payoutMethod })
      toast.success('Payout requested. We’ll process it within the next payout cycle.')
      setPayoutAmount('')
      const res = await http.get('/affiliates/dashboard')
      setData(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Request failed')
    } finally {
      setRequestingPayout(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>Loading dashboard…</Card>
      </div>
    )
  }

  if (data && !data.approved) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <h1 className="text-xl font-bold text-slate-900">Affiliate dashboard</h1>
          <p className="mt-2 text-slate-600">
            You’re not an approved affiliate yet. Apply at the link below and we’ll email you once your application is
            approved.
          </p>
          <Link to="/affiliates/register" className="mt-4 inline-block">
            <Button>Apply to become an affiliate</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const stats = data?.stats ?? {}
  const affiliate = data?.affiliate ?? {}
  const tierProgress = data?.tier_progress ?? {}
  const minPayout = data?.min_payout ?? 50
  const balance = stats.commission_approved ?? 0

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Affiliate dashboard</h1>
        <p className="mt-1 text-slate-600">Track clicks, signups, and commissions.</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-sm font-medium text-slate-500">Total clicks</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total_clicks ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm font-medium text-slate-500">Total signups</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total_signups ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm font-medium text-slate-500">Active users</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{stats.active_users ?? 0}</div>
        </Card>
        <Card>
          <div className="text-sm font-medium text-slate-500">Commission earned (this period)</div>
          <div className="mt-1 text-2xl font-bold text-emerald-600">
            ${((Number(stats.commission_pending) || 0) + (Number(stats.commission_approved) || 0) + (Number(stats.commission_paid) || 0)).toFixed(2)}
          </div>
        </Card>
      </div>

      {/* Analytics charts */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Performance over time</h2>
          <select
            value={chartDays}
            onChange={(e) => setChartDays(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-3">
          <SimpleLineChart
            series={analytics?.series ?? []}
            valueKey="clicks"
            title="Clicks"
            valueLabel="Link clicks"
            color="#0d9488"
            formatValue={(n) => `${n} clicks`}
          />
          <SimpleLineChart
            series={analytics?.series ?? []}
            valueKey="signups"
            title="Signups"
            valueLabel="New signups"
            color="#0369a1"
            formatValue={(n) => `${n} signups`}
          />
          <SimpleLineChart
            series={analytics?.series ?? []}
            valueKey="commission"
            title="Commission"
            valueLabel="Earned ($)"
            color="#059669"
            formatValue={(n) => `$${Number(n).toFixed(2)}`}
          />
        </div>
      </div>

      {/* Commission status */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Commission status</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tier: <strong>{TIER_LABELS[affiliate.tier_level] ?? '7%'}</strong> — Commission applies to platform fees from
          referred users’ first 30 days.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-sm text-slate-500">Pending</div>
            <div className="font-semibold text-slate-900">${(stats.commission_pending ?? 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Approved (available for payout)</div>
            <div className="font-semibold text-emerald-600">${(stats.commission_approved ?? 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Paid</div>
            <div className="font-semibold text-slate-900">${(stats.commission_paid ?? 0).toFixed(2)}</div>
          </div>
        </div>
        {tierProgress.next_tier_at != null && (
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">
                {tierProgress.users_this_period ?? 0} / {tierProgress.next_tier_at} users to reach next tier
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{
                  width: `${Math.min(100, ((tierProgress.users_this_period ?? 0) / (tierProgress.next_tier_at ?? 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Promo codes */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Promo codes & referral link</h2>
        <form onSubmit={handleCreatePromo} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <Label htmlFor="promo_code">Code name</Label>
            <Input
              id="promo_code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="e.g. WODEMAY10"
              className="uppercase"
            />
          </div>
          <div className="min-w-[180px]">
            <Label htmlFor="promo_desc">Description (optional)</Label>
            <Input
              id="promo_desc"
              value={promoDesc}
              onChange={(e) => setPromoDesc(e.target.value)}
              placeholder="e.g. May promo"
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create promo code'}
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Use letters, numbers, underscores. Your referral link will be: https://locallink.agency/register?ref=YOURCODE
        </p>
        <ul className="mt-4 space-y-2">
          {(data?.promo_codes ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 p-3">
              <span className="font-mono font-semibold">{p.code}</span>
              {p.description && <span className="text-sm text-slate-600">{p.description}</span>}
              <a
                href={`${window.location.origin}/register?ref=${encodeURIComponent(p.code)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-600 hover:underline"
              >
                Copy link
              </a>
            </li>
          ))}
          {(!data?.promo_codes || data.promo_codes.length === 0) && (
            <li className="text-sm text-slate-500">No promo codes yet. Create one above.</li>
          )}
        </ul>
      </Card>

      {/* Payout */}
      <Card>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Request payout</h2>
        <p className="mt-1 text-sm text-slate-600">
          Minimum payout: ${minPayout}. Balance available: <strong>${balance.toFixed(2)}</strong>
        </p>
        <form onSubmit={handleRequestPayout} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[120px]">
            <Label htmlFor="payout_amount">Amount ($)</Label>
            <Input
              id="payout_amount"
              type="number"
              min={minPayout}
              step={1}
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="50"
            />
          </div>
          <div className="min-w-[120px]">
            <Label htmlFor="payout_method">Method</Label>
            <select
              id="payout_method"
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="momo">MoMo</option>
              <option value="bank">Bank transfer</option>
            </select>
          </div>
          <Button type="submit" disabled={requestingPayout || balance < minPayout}>
            {requestingPayout ? 'Requesting…' : 'Request payout'}
          </Button>
        </form>
        {(data?.payouts?.length ?? 0) > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-700">Payout history</h3>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Amount</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{new Date(p.requested_at).toLocaleDateString()}</td>
                    <td className="py-2 pr-4">${Number(p.amount).toFixed(2)}</td>
                    <td className="py-2 pr-4">{p.method}</td>
                    <td className="py-2">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
