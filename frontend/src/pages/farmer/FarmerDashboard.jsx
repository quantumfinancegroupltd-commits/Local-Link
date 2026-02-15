import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { VerifyAccountBanner } from '../../components/verification/VerifyAccountBanner.jsx'

export function FarmerDashboard() {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [farmerProfile, setFarmerProfile] = useState(null)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [walletTab, setWalletTab] = useState('transactions')
  const [payouts, setPayouts] = useState([])
  const [disputes, setDisputes] = useState([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('momo')
  const [withdrawDetails, setWithdrawDetails] = useState({ network: 'MTN', phone: '' })
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawError, setWithdrawError] = useState(null)
  const [withdrawSuccess, setWithdrawSuccess] = useState(null)
  const [deleteBusyId, setDeleteBusyId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setDeleteError(null)
      try {
        const [res, fp] = await Promise.all([http.get('/products/mine'), http.get('/farmers/me').catch(() => ({ data: null }))])
        if (!cancelled) setProducts(Array.isArray(res.data) ? res.data : res.data?.products ?? [])
        if (!cancelled) setFarmerProfile(fp.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load products')
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

  const currency = summary?.currency ?? 'GHS'
  const available = useMemo(() => Number(summary?.available_balance ?? 0), [summary])
  const pending = useMemo(() => Number(summary?.pending_escrow ?? 0), [summary])
  const completed = useMemo(() => Number(summary?.completed_this_month ?? 0), [summary])
  const hasFarmLocation = Boolean(String(farmerProfile?.farm_location ?? '').trim())
  const hasFarmCoords = farmerProfile?.farm_lat != null && farmerProfile?.farm_lng != null

  function goToWithdraw() {
    setWalletTab('payouts')
    setTimeout(() => document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function reloadListings() {
    const res = await http.get('/products/mine')
    setProducts(Array.isArray(res.data) ? res.data : res.data?.products ?? [])
  }

  async function deleteListing(productId) {
    const ok = window.confirm('Delete this listing? It will be hidden from the marketplace.')
    if (!ok) return
    setDeleteError(null)
    setDeleteBusyId(productId)
    try {
      await http.delete(`/products/${productId}`)
      await reloadListings()
    } catch (e) {
      setDeleteError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete listing')
    } finally {
      setDeleteBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Dashboard"
        title="Farmer Dashboard"
        subtitle={`How is your farm business doing today${user?.name ? `, ${user.name}` : ''}?`}
        actions={
          <>
            <Link to="/farmer/products/new">
              <Button>List produce</Button>
            </Link>
            <Link to="/messages">
              <Button variant="secondary">Messages</Button>
            </Link>
          </>
        }
      />

      <VerifyAccountBanner />

      {!hasFarmLocation ? (
        <NextStepBanner
          variant="warning"
          title="Set your farm location"
          description="Add your farm location so buyers can filter by distance and trust you more."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/profile">
                <Button>Set farm location</Button>
              </Link>
              <Link to="/farmer/products/new">
                <Button variant="secondary">List produce</Button>
              </Link>
            </div>
          }
        />
      ) : !hasFarmCoords ? (
        <NextStepBanner
          variant="warning"
          title="Improve delivery accuracy"
          description="Pick your farm location from Google Places to save coordinates (better ETA + radius filters)."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link to="/profile">
                <Button>Save coordinates</Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="secondary">View marketplace</Button>
              </Link>
            </div>
          }
        />
      ) : products.length === 0 ? (
        <NextStepBanner
          title="List your first produce"
          description="Add photos and a clear price/unit — listings with good media convert better."
          actions={
            <Link to="/farmer/products/new">
              <Button>List produce</Button>
            </Link>
          }
        />
      ) : null}

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
          <div className="mt-1 text-xs text-slate-600">Orders in progress</div>
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
          <Link to="/farmer/products/new">
            <Button variant="secondary">Add listing</Button>
          </Link>
          <Link to="/farmer/orders">
            <Button variant="secondary">Manage orders</Button>
          </Link>
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
        <div className="text-sm font-semibold">My Listings</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : deleteError ? (
          <div className="mt-3 text-sm text-red-700">{deleteError}</div>
        ) : products.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <div className="text-sm font-semibold text-slate-900">No listings yet</div>
            <div className="mt-2 text-sm text-slate-600">Add your first product to start selling on the marketplace.</div>
            <Link to="/farmer/products/new" className="mt-4 inline-block">
              <Button>Add your first product</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-3 divide-y">
            {products.map((p) => (
              <div key={p.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{p.name || 'Product'}</div>
                    <div className="text-xs text-slate-600">
                      {p.quantity ?? '—'} {p.unit ?? ''} • {p.category ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-slate-700">{p.status || 'available'}</div>
                    <Link to={`/farmer/products/${p.id}/edit`}>
                      <Button variant="secondary">Edit</Button>
                    </Link>
                    <Button
                      variant="secondary"
                      disabled={deleteBusyId === p.id}
                      onClick={() => deleteListing(p.id)}
                      title="Hides listing from the marketplace"
                    >
                      {deleteBusyId === p.id ? 'Deleting…' : 'Delete'}
                    </Button>
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


