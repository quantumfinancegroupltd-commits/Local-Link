import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { JOB_CATEGORIES_TIER1 } from '../../lib/jobCategories.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { VerifyAccountBanner } from '../../components/verification/VerifyAccountBanner.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

export function ArtisanDashboard() {
  const toast = useToast()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState([]) // provider pipeline items (see /jobs/mine)
  const [jobCounts, setJobCounts] = useState({})
  const [jobsTab, setJobsTab] = useState('new') // all | new | quoted | booked | in_progress | completed | paid | disputed | rejected
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [artisanProfile, setArtisanProfile] = useState(null)
  const [jobActionBusyId, setJobActionBusyId] = useState(null)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [walletTab, setWalletTab] = useState('transactions') // transactions | payouts | fees | disputes
  const [payouts, setPayouts] = useState([])
  const [disputes, setDisputes] = useState([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('momo')
  const [withdrawDetails, setWithdrawDetails] = useState({ network: 'MTN', phone: '' })
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawError, setWithdrawError] = useState(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [jobsRes, profileRes] = await Promise.all([
          http.get('/jobs/mine', { params: { open_limit: 60 } }),
          http.get('/artisans/me').catch(() => ({ data: null })),
        ])
        if (!cancelled) setJobs(Array.isArray(jobsRes.data?.items) ? jobsRes.data.items : [])
        if (!cancelled) setJobCounts(jobsRes.data?.counts && typeof jobsRes.data.counts === 'object' ? jobsRes.data.counts : {})
        if (!cancelled) setArtisanProfile(profileRes.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load work')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const nextTab = String(searchParams.get('tab') || '').trim()
    const nextQ = String(searchParams.get('q') || '')
    const nextCat = String(searchParams.get('category') || '')
    const allowed = new Set(['all', 'new', 'quoted', 'booked', 'in_progress', 'completed', 'paid', 'disputed', 'rejected', 'by_date'])
    if (nextTab && allowed.has(nextTab) && nextTab !== jobsTab) setJobsTab(nextTab)
    if (nextQ !== query) setQuery(nextQ)
    if (nextCat !== category) setCategory(nextCat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const t0 = String(jobsTab || '').trim()
      const q0 = String(query || '').trim()
      const c0 = String(category || '').trim()
      if (t0) next.set('tab', t0)
      else next.delete('tab')
      if (q0) next.set('q', q0)
      else next.delete('q')
      if (c0) next.set('category', c0)
      else next.delete('category')
      if (String(next.toString()) !== String(searchParams.toString())) setSearchParams(next, { replace: true })
    }, 250)
    return () => clearTimeout(t)
  }, [jobsTab, query, category, searchParams, setSearchParams])

  function csvCell(v) {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }

  async function copyCurrentLink() {
    const href = window.location?.href ? String(window.location.href) : ''
    if (!href) return toast.error('Copy failed', 'Missing URL')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(href)
        toast.success('Link copied.')
        return
      }
      window.prompt('Copy this link', href)
    } catch (e) {
      toast.error('Copy failed', e?.message ?? 'Unable to copy link')
    }
  }

  async function exportCsv() {
    if (exportBusy) return
    setExportBusy(true)
    try {
      const rows = Array.isArray(filtered) ? filtered : []
      if (!rows.length) return toast.warning('Nothing to export', 'No pipeline items match the current filter.')
      const header = [
        'job_id',
        'stage',
        'job_status',
        'title',
        'location',
        'budget',
        'accepted_quote',
        'my_quote_status',
        'my_quote_amount',
        'escrow_status',
        'escrow_amount',
        'dispute_status',
        'created_at',
      ]
      const lines = [header.join(',')]
      for (const j of rows) {
        lines.push(
          [
            csvCell(j?.id),
            csvCell(j?.stage),
            csvCell(j?.status),
            csvCell(j?.title),
            csvCell(j?.location),
            csvCell(j?.budget),
            csvCell(j?.accepted_quote),
            csvCell(j?.my_quote?.status),
            csvCell(j?.my_quote?.amount),
            csvCell(j?.escrow?.status),
            csvCell(j?.escrow?.amount),
            csvCell(j?.dispute?.status),
            csvCell(j?.created_at),
          ].join(','),
        )
      }
      const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'provider-pipeline.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export ready', `Downloaded ${rows.length} item(s).`)
    } catch (e) {
      toast.error('Export failed', e?.message ?? 'Unable to export CSV')
    } finally {
      setExportBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadWallet() {
      setSummaryLoading(true)
      try {
        const [s, t, p, d] = await Promise.all([
          http.get('/wallets/summary'),
          http.get('/wallets/transactions'),
          http.get('/wallets/payouts').catch(() => ({ data: [] })),
          http.get('/escrow/disputes').catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setSummary(s.data ?? null)
        setTransactions(Array.isArray(t.data) ? t.data : [])
        setPayouts(Array.isArray(p.data) ? p.data : [])
        setDisputes(Array.isArray(d.data) ? d.data : [])
      } finally {
        if (!cancelled) setSummaryLoading(false)
      }
    }
    loadWallet()
    return () => {
      cancelled = true
    }
  }, [])

  const stages = useMemo(
    () => [
      { key: 'all', label: 'All' },
      { key: 'by_date', label: 'By date' },
      { key: 'new', label: 'New' },
      { key: 'quoted', label: 'Quoted' },
      { key: 'booked', label: 'Booked' },
      { key: 'in_progress', label: 'In progress' },
      { key: 'completed', label: 'Completed' },
      { key: 'paid', label: 'Paid' },
      { key: 'disputed', label: 'Disputed' },
      { key: 'rejected', label: 'Rejected' },
    ],
    [],
  )

  // For "By date" view: group jobs by event/scheduled date or recurring/no date
  const jobsForDateView = useMemo(() => {
    const list = Array.isArray(jobs) ? jobs : []
    const q = String(query || '').trim().toLowerCase()
    const cat = String(category || '').trim()
    return list.filter((j) => {
      if (!j) return false
      if (cat && (j?.category ?? '') !== cat) return false
      if (!q) return true
      const hay = `${j.title ?? ''} ${j.description ?? ''} ${j.location ?? ''} ${j.category ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [jobs, query, category])

  const jobsGroupedByDate = useMemo(() => {
    const groups = {}
    const now = Date.now()
    for (const j of jobsForDateView) {
      let key
      let sortKey
      if (j.scheduled_at) {
        const d = new Date(j.scheduled_at)
        key = d.toISOString().slice(0, 10) // YYYY-MM-DD
        sortKey = d.getTime()
      } else if (j.recurring_frequency) {
        key = 'recurring'
        sortKey = Number.MAX_SAFE_INTEGER - 1
      } else {
        key = 'no_date'
        sortKey = Number.MAX_SAFE_INTEGER
      }
      if (!groups[key]) groups[key] = { key, sortKey, jobs: [] }
      groups[key].jobs.push(j)
    }
    // Sort: dates chronological (soonest first), then recurring, then no_date
    return Object.values(groups).sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
  }, [jobsForDateView])

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    const cat = String(category || '').trim()
    const list = Array.isArray(jobs) ? jobs : []
    return list.filter((j) => {
      if (!j) return false
      const stage = String(j.stage || '').trim()
      if (jobsTab !== 'all' && stage !== jobsTab) return false
      if (cat && (j?.category ?? '') !== cat) return false
      if (!q) return true
      const hay = `${j.title ?? ''} ${j.description ?? ''} ${j.location ?? ''} ${j.category ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [jobs, jobsTab, query, category])

  async function reloadPipeline() {
    try {
      const r = await http.get('/jobs/mine', { params: { open_limit: 60 } })
      setJobs(Array.isArray(r.data?.items) ? r.data.items : [])
      setJobCounts(r.data?.counts && typeof r.data.counts === 'object' ? r.data.counts : {})
    } catch {
      // ignore
    }
  }

  async function startJob(jobId) {
    const id = String(jobId || '').trim()
    if (!id) return
    if (jobActionBusyId) return
    const ok = window.confirm('Mark this job as started?')
    if (!ok) return
    setJobActionBusyId(id)
    try {
      await http.post(`/jobs/${encodeURIComponent(id)}/start`)
      await reloadPipeline()
    } finally {
      setJobActionBusyId(null)
    }
  }

  async function completeJob(jobId) {
    const id = String(jobId || '').trim()
    if (!id) return
    if (jobActionBusyId) return
    const ok = window.confirm('Mark this job as completed?')
    if (!ok) return
    setJobActionBusyId(id)
    try {
      await http.post(`/jobs/${encodeURIComponent(id)}/complete`)
      await reloadPipeline()
    } finally {
      setJobActionBusyId(null)
    }
  }

  const currency = summary?.currency ?? 'GHS'
  const available = useMemo(() => Number(summary?.available_balance ?? 0), [summary])
  const pending = useMemo(() => Number(summary?.pending_escrow ?? 0), [summary])
  const completed = useMemo(() => Number(summary?.completed_this_month ?? 0), [summary])
  const primarySkill = useMemo(() => {
    const skills = Array.isArray(artisanProfile?.skills) ? artisanProfile.skills.filter(Boolean) : []
    const s = skills[0] ? String(skills[0]) : ''
    if (!s.trim()) return null
    // Title-case-ish for common inputs like "plumber"
    return s
      .trim()
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
  }, [artisanProfile])

  const hasArtisanProfile = Boolean(artisanProfile)
  const hasSkills = Array.isArray(artisanProfile?.skills) && artisanProfile.skills.filter(Boolean).length > 0
  const hasServiceArea = Boolean(String(artisanProfile?.service_area ?? '').trim())

  function goToWithdraw() {
    setWalletTab('payouts')
    setTimeout(() => document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Dashboard"
        title={primarySkill ? `${primarySkill} Dashboard` : 'Artisan Dashboard'}
        subtitle={`How is your business doing today${user?.name ? `, ${user.name}` : ''}?`}
        actions={
          <>
            <Link to="/profile">
              <Button variant="secondary">Profile</Button>
            </Link>
            <Link to="/messages">
              <Button variant="secondary">Messages</Button>
            </Link>
          </>
        }
      />

      <VerifyAccountBanner />

      {!hasArtisanProfile ? (
        <NextStepBanner
          variant="warning"
          title="Finish your artisan profile to start getting hired"
          description="Add your skills and service area — then you can start responding to new job requests."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/profile">
                <Button>Complete profile</Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Browse jobs
              </Button>
            </div>
          }
        />
      ) : !hasSkills || !hasServiceArea ? (
        <NextStepBanner
          variant="warning"
          title="Improve your visibility"
          description="Providers with clear skills + service area rank better and get faster responses from buyers."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/profile">
                <Button>Update skills & area</Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                View requests
              </Button>
            </div>
          }
        />
      ) : jobs.length === 0 ? (
        <NextStepBanner
          title="No quotes yet"
          description="Once buyers post jobs in your area, they’ll show up here. Browse jobs or improve your profile to get noticed."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/jobs">
                <Button>Browse jobs</Button>
              </Link>
              <Link to="/profile">
                <Button variant="secondary">Improve your profile</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <NextStepBanner
          title="Start earning: send your first quote"
          description="Pick a job request, submit a clear quote and timeline. Fast responses build trust."
          actions={
            <Button onClick={() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              View new requests
            </Button>
          }
        />
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-xs text-slate-600">Available balance</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {currency} {summaryLoading ? '—' : available.toFixed(0)}
          </div>
          <div className="mt-3">
            <Button
              variant="secondary"
              disabled={summaryLoading || available <= 0}
              onClick={goToWithdraw}
              title={summaryLoading ? 'Loading…' : available <= 0 ? 'No available balance to withdraw yet' : 'Request a withdrawal'}
            >
              Withdraw
            </Button>
          </div>
        </Card>
        <Card>
          <div className="text-xs text-slate-600">Pending (Escrow)</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {currency} {summaryLoading ? '—' : pending.toFixed(0)}
          </div>
          <div className="mt-1 text-xs text-slate-600">Jobs/orders in progress</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-600">Completed this month</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {currency} {summaryLoading ? '—' : completed.toFixed(0)}
          </div>
          <div className="mt-1 text-xs text-slate-600">After platform fees</div>
        </Card>
      </div>

      <Card>
        <div className="text-sm font-semibold">Quick actions</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' })}>
            View new requests
          </Button>
          <Link to="/reviews">
            <Button variant="secondary">View reviews</Button>
          </Link>
          <Link to="/verify">
            <Button variant="secondary">Verify ID</Button>
          </Link>
        </div>
      </Card>

      <Card id="wallet">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold">Wallet</div>
          <div className="flex flex-wrap gap-2">
            <Button variant={walletTab === 'transactions' ? 'primary' : 'secondary'} onClick={() => setWalletTab('transactions')}>
              Transactions
            </Button>
            <Button variant={walletTab === 'payouts' ? 'primary' : 'secondary'} onClick={() => setWalletTab('payouts')}>
              Payouts
            </Button>
            <Button variant={walletTab === 'fees' ? 'primary' : 'secondary'} onClick={() => setWalletTab('fees')}>
              Fees
            </Button>
            <Button variant={walletTab === 'disputes' ? 'primary' : 'secondary'} onClick={() => setWalletTab('disputes')}>
              Disputes
            </Button>
          </div>
        </div>

        {walletTab === 'transactions' ? (
          transactions.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">No transactions yet.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((t) => {
                    const source = t.type === 'job' ? 'Job' : 'Order'
                    const amt = Number(t.amount ?? 0) - Number(t.platform_fee ?? 0)
                    const isIn = t.counterparty_user_id && user?.id && t.counterparty_user_id === user.id
                    const sign = isIn ? '+' : '-'
                    return (
                      <tr key={t.id}>
                        <td className="py-2 pr-3 text-slate-700">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td className="py-2 pr-3 text-slate-700">{source}</td>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {sign} {currency} {Math.abs(amt).toFixed(0)}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{t.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <>
            {walletTab === 'payouts' ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                  <div className="font-semibold">When you get paid</div>
                  <p className="mt-1 text-emerald-800">
                    Payouts are processed within <strong>5 business days</strong> after you request a withdrawal. Our team reviews each request and will notify you once the transfer is made. Auto-payout (e.g. MoMo) is on the roadmap.
                  </p>
                </div>
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <div className="text-sm font-semibold">Request withdrawal</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    <div>
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={`${currency}`}
                      />
                    </div>
                    <div>
                      <Label>Method</Label>
                      <Select value={withdrawMethod} onChange={(e) => setWithdrawMethod(e.target.value)}>
                        <option value="momo">Mobile Money</option>
                        <option value="bank">Bank</option>
                      </Select>
                    </div>
                    <div>
                      <Label>Details</Label>
                      {withdrawMethod === 'momo' ? (
                        <div className="flex gap-2">
                          <Select
                            value={withdrawDetails.network ?? 'MTN'}
                            onChange={(e) => setWithdrawDetails((d) => ({ ...d, network: e.target.value }))}
                          >
                            <option value="MTN">MTN</option>
                            <option value="VOD">Vodafone</option>
                            <option value="ATL">AirtelTigo</option>
                          </Select>
                          <Input
                            value={withdrawDetails.phone ?? ''}
                            onChange={(e) => setWithdrawDetails((d) => ({ ...d, phone: e.target.value }))}
                            placeholder="Phone"
                          />
                        </div>
                      ) : (
                        <Input
                          value={withdrawDetails.account ?? ''}
                          onChange={(e) => setWithdrawDetails((d) => ({ ...d, account: e.target.value }))}
                          placeholder="Account number"
                        />
                      )}
                    </div>
                  </div>
                  {withdrawError ? (
                    <div className="mt-3 text-sm text-red-700">{withdrawError}</div>
                  ) : withdrawSuccess ? (
                    <div className="mt-3 text-sm text-emerald-700">{withdrawSuccess}</div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-600">Withdrawals are reviewed before payout (MVP).</div>
                  )}
                  <div className="mt-3">
                    <Button
                      disabled={withdrawBusy}
                      onClick={async () => {
                        setWithdrawBusy(true)
                        setWithdrawError(null)
                        setWithdrawSuccess(null)
                        try {
                          const amount = Number(withdrawAmount)
                          if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid amount')
                          const res = await http.post('/wallets/withdraw', {
                            amount,
                            method: withdrawMethod,
                            details: withdrawDetails,
                          })
                          setPayouts((p) => [res.data, ...p])
                          setWithdrawAmount('')
                          const s = await http.get('/wallets/summary')
                          setSummary(s.data ?? null)
                          setWithdrawSuccess('Withdrawal request submitted. We’ll review it shortly.')
                          setTimeout(() => setWithdrawSuccess(null), 5000)
                        } catch (err) {
                          setWithdrawError(err?.response?.data?.message ?? err?.message ?? 'Withdraw failed')
                        } finally {
                          setWithdrawBusy(false)
                        }
                      }}
                    >
                      {withdrawBusy ? 'Requesting…' : 'Withdraw'}
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold">Payouts</div>
                  {payouts.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-600">No payouts yet.</div>
                  ) : (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs text-slate-500">
                          <tr>
                            <th className="py-2 pr-3">Date</th>
                            <th className="py-2 pr-3">Method</th>
                            <th className="py-2 pr-3">Amount</th>
                            <th className="py-2 pr-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {payouts.map((p) => (
                            <tr key={p.id}>
                              <td className="py-2 pr-3 text-slate-700">{new Date(p.created_at).toLocaleDateString()}</td>
                              <td className="py-2 pr-3 text-slate-700">{p.method}</td>
                              <td className="py-2 pr-3 font-medium text-slate-900">
                                {currency} {Number(p.amount ?? 0).toFixed(0)}
                              </td>
                              <td className="py-2 pr-3">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{p.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : walletTab === 'disputes' ? (
              <div className="mt-3">
                {disputes.length === 0 ? (
                  <div className="text-sm text-slate-600">No disputes.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-slate-500">
                        <tr>
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3">Reason</th>
                          <th className="py-2 pr-3">Amount</th>
                          <th className="py-2 pr-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {disputes.map((d) => (
                          <tr key={d.id}>
                            <td className="py-2 pr-3 text-slate-700">{new Date(d.created_at).toLocaleDateString()}</td>
                            <td className="py-2 pr-3 text-slate-700">{d.reason}</td>
                            <td className="py-2 pr-3 font-medium text-slate-900">
                              {currency} {Number(d.escrow_amount ?? 0).toFixed(0)}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{d.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : walletTab === 'fees' ? (
              <div className="mt-3 text-sm text-slate-600">
                Fees are deducted on escrow release. You can see platform fees on each transaction once released.
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-600">Coming soon.</div>
            )}
          </>
        )}
      </Card>

      <Card>
        <div id="jobs" className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Work pipeline</div>
            <div className="mt-1 text-xs text-slate-600">Track quotes, bookings, job progress, escrow and disputes.</div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <div className="w-full md:w-48">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs…" />
            </div>
            <div className="w-full md:w-44">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {JOB_CATEGORIES_TIER1.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <Button size="sm" variant="secondary" onClick={() => copyCurrentLink().catch(() => {})}>
              Copy link
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => exportCsv().catch(() => {})}>
              {exportBusy ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button variant="secondary" onClick={() => reloadPipeline().catch(() => {})} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {stages.map((t) => {
            const n = t.key === 'all' ? (Array.isArray(jobs) ? jobs.length : 0) : t.key === 'by_date' ? jobsForDateView.length : Number(jobCounts?.[t.key] ?? 0)
            const active = jobsTab === t.key
            return (
              <Button key={t.key} variant={active ? 'primary' : 'secondary'} onClick={() => setJobsTab(t.key)}>
                {t.label} {Number.isFinite(n) ? `(${n})` : ''}
              </Button>
            )
          })}
        </div>

        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : jobsTab === 'by_date' ? (
          jobsGroupedByDate.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">No jobs with dates. Post a job with an event date or recurring pattern to see it here.</div>
          ) : (
            <div className="mt-3 space-y-6">
              {jobsGroupedByDate.map((group) => (
                <div key={group.key}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {group.key === 'recurring'
                      ? 'Recurring'
                      : group.key === 'no_date'
                        ? 'No date set'
                        : (() => {
                            const d = new Date(group.key + 'T12:00:00')
                            return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                          })()}
                  </div>
                  <div className="divide-y rounded-lg border border-slate-200 bg-slate-50/50">
                    {group.jobs.map((j) => (
                      <div key={j.id} className="bg-white p-3 first:rounded-t-lg last:rounded-b-lg">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold">{j.title || 'Job'}</div>
                              {j.stage === 'new' && j.category && Array.isArray(artisanProfile?.job_categories) && artisanProfile.job_categories.includes(j.category) ? (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Matches your services</span>
                              ) : null}
                              <StatusPill status={j.stage || j.status || 'open'} label={j.stage ? String(j.stage).replaceAll('_', ' ') : undefined} />
                              {j?.recurring_frequency ? (
                                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                  {j.recurring_frequency}
                                  {j.recurring_end_date ? ` until ${new Date(j.recurring_end_date).toLocaleDateString()}` : ''}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span>{j.location || '—'}</span>
                              {j.category ? (
                                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-slate-700">{j.category}</span>
                              ) : null}
                            </div>
                            {j.access_instructions ? (
                              <div className="mt-1 text-xs text-slate-600">
                                <span className="font-medium text-slate-700">Access:</span> {String(j.access_instructions).slice(0, 80)}{String(j.access_instructions).length > 80 ? '…' : ''}
                              </div>
                            ) : null}
                            {(j.event_head_count != null || j.event_menu_notes || j.event_equipment) ? (
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                                {j.event_head_count != null ? <span className="font-medium text-slate-700">Guests: {Number(j.event_head_count)}</span> : null}
                                {j.event_menu_notes ? <span className="text-slate-600">Menu: {String(j.event_menu_notes).slice(0, 50)}{String(j.event_menu_notes).length > 50 ? '…' : ''}</span> : null}
                                {j.event_equipment ? <span className="text-slate-600">Equipment: {String(j.event_equipment).slice(0, 50)}{String(j.event_equipment).length > 50 ? '…' : ''}</span> : null}
                              </div>
                            ) : null}
                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                              {j?.budget != null && Number(j.budget) > 0 ? <span className="font-semibold text-slate-700">Budget: GHS {Number(j.budget).toFixed(0)}</span> : null}
                              {j?.my_quote?.amount != null ? <span>Your quote: GHS {Number(j.my_quote.amount).toFixed(0)}</span> : null}
                              {j?.accepted_quote != null ? <span>Accepted: GHS {Number(j.accepted_quote).toFixed(0)}</span> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link to={`/artisan/jobs/${j.id}`}>
                              <Button variant="secondary">Open</Button>
                            </Link>
                            {String(j.status || '') === 'assigned' ? (
                              <Button variant="secondary" disabled={jobActionBusyId === j.id} onClick={() => startJob(j.id)}>
                                {jobActionBusyId === j.id ? 'Working…' : 'Start'}
                              </Button>
                            ) : null}
                            {String(j.status || '') === 'in_progress' ? (
                              <Button variant="secondary" disabled={jobActionBusyId === j.id} onClick={() => completeJob(j.id)}>
                                {jobActionBusyId === j.id ? 'Working…' : 'Complete'}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No items found for this view.</div>
        ) : (
          <div className="mt-3 divide-y">
            {filtered.map((j) => (
              <div key={j.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold">{j.title || 'Job'}</div>
                      {j.stage === 'new' && j.category && Array.isArray(artisanProfile?.job_categories) && artisanProfile.job_categories.includes(j.category) ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Matches your services</span>
                      ) : null}
                      <StatusPill status={j.stage || j.status || 'open'} label={j.stage ? String(j.stage).replaceAll('_', ' ') : undefined} />
                      {j?.my_quote?.status ? <StatusPill status={j.my_quote.status} label={`quote: ${j.my_quote.status}`} /> : null}
                      {j?.escrow?.status ? <StatusPill status={j.escrow.status} label={`escrow: ${j.escrow.status}`} /> : null}
                      {j?.dispute?.status ? <StatusPill status={j.dispute.status} label={`dispute: ${j.dispute.status}`} /> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>{j.location || '—'}</span>
                      {j.category ? (
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-slate-700">{j.category}</span>
                      ) : null}
                    </div>
                    {j.access_instructions ? (
                      <div className="mt-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Access:</span> {String(j.access_instructions).slice(0, 80)}{String(j.access_instructions).length > 80 ? '…' : ''}
                      </div>
                    ) : null}
                    {(j.event_head_count != null || j.event_menu_notes || j.event_equipment) ? (
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                        {j.event_head_count != null ? <span className="font-medium text-slate-700">Guests: {Number(j.event_head_count)}</span> : null}
                        {j.event_menu_notes ? <span>Menu: {String(j.event_menu_notes).slice(0, 50)}{String(j.event_menu_notes).length > 50 ? '…' : ''}</span> : null}
                        {j.event_equipment ? <span>Equipment: {String(j.event_equipment).slice(0, 50)}{String(j.event_equipment).length > 50 ? '…' : ''}</span> : null}
                      </div>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600">
                      {j?.budget != null && Number(j.budget) > 0 ? <span className="font-semibold text-slate-700">Budget: GHS {Number(j.budget).toFixed(0)}</span> : null}
                      {j?.my_quote?.amount != null ? <span>Your quote: GHS {Number(j.my_quote.amount).toFixed(0)}</span> : null}
                      {j?.accepted_quote != null ? <span>Accepted: GHS {Number(j.accepted_quote).toFixed(0)}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/artisan/jobs/${j.id}`}>
                      <Button variant="secondary">Open</Button>
                    </Link>
                    {String(j.status || '') === 'assigned' ? (
                      <Button variant="secondary" disabled={jobActionBusyId === j.id} onClick={() => startJob(j.id)}>
                        {jobActionBusyId === j.id ? 'Working…' : 'Start'}
                      </Button>
                    ) : null}
                    {String(j.status || '') === 'in_progress' ? (
                      <Button variant="secondary" disabled={jobActionBusyId === j.id} onClick={() => completeJob(j.id)}>
                        {jobActionBusyId === j.id ? 'Working…' : 'Complete'}
                      </Button>
                    ) : null}
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


