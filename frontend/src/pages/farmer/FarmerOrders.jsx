import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { StatusTimeline } from '../../components/ui/StatusTimeline.jsx'
import { buildDeliveryTimeline } from '../../lib/statusTimelines.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function FarmerOrders() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('active') // active | pending | ... | all | by_date
  const [query, setQuery] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [expandedDeliveryId, setExpandedDeliveryId] = useState(null)
  const [metricsByDeliveryId, setMetricsByDeliveryId] = useState({})
  const [metricsBusyId, setMetricsBusyId] = useState(null)
  const [metricsError, setMetricsError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await http.get('/orders')
        if (cancelled) return
        setOrders(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load orders')
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
    const allowed = new Set(['active', 'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'all', 'by_date'])
    if (nextTab && allowed.has(nextTab) && nextTab !== tab) setTab(nextTab)
    if (nextQ !== query) setQuery(nextQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const t0 = String(tab || '').trim()
      const q0 = String(query || '').trim()
      if (t0) next.set('tab', t0)
      else next.delete('tab')
      if (q0) next.set('q', q0)
      else next.delete('q')
      if (String(next.toString()) !== String(searchParams.toString())) setSearchParams(next, { replace: true })
    }, 250)
    return () => clearTimeout(t)
  }, [tab, query, searchParams, setSearchParams])

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
      if (!rows.length) return toast.warning('Nothing to export', 'No orders match the current filter.')
      const header = [
        'order_id',
        'order_status',
        'payment_status',
        'produce_escrow_status',
        'produce_escrow_amount',
        'delivery_id',
        'delivery_status',
        'product_name',
        'quantity',
        'total_price',
        'delivery_fee',
        'buyer_name',
        'pickup_location',
        'dropoff_location',
        'created_at',
      ]
      const lines = [header.join(',')]
      for (const o of rows) {
        lines.push(
          [
            csvCell(o?.id),
            csvCell(o?.order_status),
            csvCell(o?.payment_status),
            csvCell(o?.produce_escrow_status),
            csvCell(o?.produce_escrow_amount),
            csvCell(o?.delivery_id),
            csvCell(o?.delivery_status),
            csvCell(o?.product_name),
            csvCell(o?.quantity),
            csvCell(o?.total_price),
            csvCell(o?.delivery_fee),
            csvCell(o?.buyer_name),
            csvCell(o?.pickup_location),
            csvCell(o?.dropoff_location),
            csvCell(o?.created_at),
          ].join(','),
        )
      }
      const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'farmer-orders.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export ready', `Downloaded ${rows.length} order(s).`)
    } catch (e) {
      toast.error('Export failed', e?.message ?? 'Unable to export CSV')
    } finally {
      setExportBusy(false)
    }
  }

  const counts = useMemo(() => {
    const list = Array.isArray(orders) ? orders : []
    const out = { all: list.length, active: 0, pending: 0, confirmed: 0, dispatched: 0, delivered: 0, cancelled: 0 }
    for (const o of list) {
      const s = String(o?.order_status || 'pending')
      if (s === 'pending') out.pending += 1
      else if (s === 'confirmed') out.confirmed += 1
      else if (s === 'dispatched') out.dispatched += 1
      else if (s === 'delivered') out.delivered += 1
      else if (s === 'cancelled') out.cancelled += 1
      if (!['cancelled', 'delivered'].includes(s)) out.active += 1
    }
    return out
  }, [orders])

  const filtered = useMemo(() => {
    const list = Array.isArray(orders) ? orders : []
    const q = String(query || '').trim().toLowerCase()
    return list.filter((o) => {
      const s = String(o?.order_status || 'pending')
      if (tab !== 'by_date') {
        if (tab === 'active' && ['cancelled', 'delivered'].includes(s)) return false
        if (tab === 'pending' && s !== 'pending') return false
        if (tab === 'confirmed' && s !== 'confirmed') return false
        if (tab === 'dispatched' && s !== 'dispatched') return false
        if (tab === 'delivered' && s !== 'delivered') return false
        if (tab === 'cancelled' && s !== 'cancelled') return false
      }
      if (!q) return true
      const hay = `${o?.product_name ?? ''} ${o?.buyer_name ?? ''} ${o?.pickup_location ?? ''} ${o?.dropoff_location ?? ''} ${o?.dropoff_address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [orders, tab, query])

  const ordersGroupedByDate = useMemo(() => {
    if (tab !== 'by_date') return []
    const groups = {}
    for (const o of filtered) {
      const dateStr = o.requested_delivery_date || (o.created_at ? new Date(o.created_at).toISOString().slice(0, 10) : null)
      const key = dateStr || 'no_date'
      const sortKey = dateStr ? new Date(dateStr + 'T12:00:00Z').getTime() : Number.MAX_SAFE_INTEGER
      if (!groups[key]) groups[key] = { key, sortKey, orders: [] }
      groups[key].orders.push(o)
    }
    return Object.values(groups).sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
  }, [tab, filtered])

  function formatGroupLabel(key) {
    if (key === 'no_date') return 'No date set'
    try {
      const d = new Date(key + 'T12:00:00Z')
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return key
    }
  }

  function orderCard(o) {
    const qty = `${o.quantity ?? '—'}`
    const buyerName = o.buyer_name || 'Buyer'
    const productName = o.product_name || 'Product'
    const produceEscrow = o.produce_escrow_status || o.payment_status || '—'
    const deliveryStatus = o.delivery_status || 'created'
    const deliveryId = o.delivery_id
    const expanded = expandedDeliveryId && deliveryId && expandedDeliveryId === deliveryId
    const metrics = deliveryId ? metricsByDeliveryId[deliveryId] : null
    return (
      <Card key={o.id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{productName}</div>
            <div className="mt-1 text-xs text-slate-600">
              Qty: {qty} • Order: <span className="font-semibold">{o.order_status}</span>
              {o.requested_delivery_date ? (
                <span className="ml-2 text-slate-700"> • Deliver by: {new Date(o.requested_delivery_date + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={produceEscrow} label={`Escrow: ${produceEscrow}`} />
              <StatusPill status={deliveryStatus} label={`Delivery: ${deliveryStatus}`} />
            </div>
            {String(o.produce_escrow_status || '') === 'disputed' ? (
              <NextStepBanner
                className="mt-3"
                variant="warning"
                title={`Dispute: ${o.produce_dispute_status === 'open' ? 'Open' : o.produce_dispute_status === 'under_review' ? 'Under review' : o.produce_dispute_status === 'resolved' ? 'Resolved' : 'Disputed'}`}
                description={
                  o.produce_dispute_status === 'open'
                    ? 'Admin will review shortly. No action needed.'
                    : o.produce_dispute_status === 'under_review'
                      ? "Admin is reviewing. You'll be notified when resolved."
                      : o.produce_dispute_status === 'resolved'
                        ? 'Resolved. Payout applied per admin decision.'
                        : 'Escrow is frozen while the dispute is reviewed.'
                }
              />
            ) : null}
            <div className="mt-2 text-xs text-slate-600">
              Buyer: <span className="font-semibold text-slate-800">{buyerName}</span>
              {o.buyer_rating != null ? <span className="text-slate-500"> • Rating {Number(o.buyer_rating).toFixed(1)}</span> : null}
            </div>
            {(o.occasion || o.gift_message) ? (
              <div className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs text-slate-700">
                {o.occasion ? <div><span className="font-medium">Occasion:</span> {o.occasion}</div> : null}
                {o.gift_message ? <div><span className="font-medium">Message:</span> <span className="whitespace-pre-wrap">{o.gift_message}</span></div> : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/messages/order/${o.id}`}>
              <Button variant="secondary">Message</Button>
            </Link>
            <Button
              variant="secondary"
              disabled={!deliveryId}
              onClick={() => toggleTracking(deliveryId)}
              title={!deliveryId ? 'Delivery not created yet' : 'View tracking'}
            >
              {expanded ? 'Hide tracking' : metricsBusyId === deliveryId ? 'Loading…' : 'Track delivery'}
            </Button>
          </div>
        </div>
        {expanded ? (
          <div className="mt-4 space-y-3">
            {metricsError ? <div className="text-sm text-red-700">{metricsError}</div> : null}
            <StatusTimeline
              items={buildDeliveryTimeline({
                status: deliveryStatus,
                hasDriver: Boolean(o.driver_user_id),
              })}
              metrics={metrics}
            />
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                <div className="text-xs text-slate-600">Pickup</div>
                <div className="mt-1 font-medium text-slate-900">{o.pickup_location || '—'}</div>
              </div>
              <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                <div className="text-xs text-slate-600">Drop-off</div>
                <div className="mt-1 font-medium text-slate-900">{o.dropoff_location || '—'}</div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    )
  }

  async function toggleTracking(deliveryId) {
    setMetricsError(null)
    if (!deliveryId) return
    if (expandedDeliveryId === deliveryId) {
      setExpandedDeliveryId(null)
      return
    }
    setExpandedDeliveryId(deliveryId)
    if (metricsByDeliveryId[deliveryId]) return
    setMetricsBusyId(deliveryId)
    try {
      const r = await http.get(`/deliveries/${deliveryId}/metrics`)
      setMetricsByDeliveryId((m) => ({ ...m, [deliveryId]: r.data }))
    } catch (e) {
      setMetricsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load tracking metrics')
    } finally {
      setMetricsBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Farmer / Florist"
        title="Orders"
        subtitle={`${counts.all} total • ${counts.active} active`}
        actions={
          <>
            <Link to="/farmer">
              <Button variant="secondary">Back</Button>
            </Link>
            <Link to="/messages">
              <Button variant="secondary">Messages</Button>
            </Link>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Order pipeline</div>
            <div className="mt-1 text-xs text-slate-600">Filter by stage and track delivery + escrow status.</div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <div className="w-full md:w-64">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders…" />
            </div>
            <Button size="sm" variant="secondary" onClick={() => copyCurrentLink().catch(() => {})}>
              Copy link
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => exportCsv().catch(() => {})}>
              {exportBusy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={tab === 'active' ? 'primary' : 'secondary'} onClick={() => setTab('active')}>
            Active ({counts.active})
          </Button>
          <Button variant={tab === 'pending' ? 'primary' : 'secondary'} onClick={() => setTab('pending')}>
            Pending ({counts.pending})
          </Button>
          <Button variant={tab === 'confirmed' ? 'primary' : 'secondary'} onClick={() => setTab('confirmed')}>
            Confirmed ({counts.confirmed})
          </Button>
          <Button variant={tab === 'dispatched' ? 'primary' : 'secondary'} onClick={() => setTab('dispatched')}>
            Dispatched ({counts.dispatched})
          </Button>
          <Button variant={tab === 'delivered' ? 'primary' : 'secondary'} onClick={() => setTab('delivered')}>
            Delivered ({counts.delivered})
          </Button>
          <Button variant={tab === 'cancelled' ? 'primary' : 'secondary'} onClick={() => setTab('cancelled')}>
            Cancelled ({counts.cancelled})
          </Button>
          <Button variant={tab === 'all' ? 'primary' : 'secondary'} onClick={() => setTab('all')}>
            All ({counts.all})
          </Button>
          <Button variant={tab === 'by_date' ? 'primary' : 'secondary'} onClick={() => setTab('by_date')}>
            By date ({filtered.length})
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="text-sm text-slate-600">Loading…</div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No orders found for this view.</div>
        </Card>
      ) : tab === 'by_date' ? (
        <div className="space-y-6">
          {ordersGroupedByDate.map((grp) => (
            <div key={grp.key}>
              <div className="mb-2 text-sm font-semibold text-slate-700">{formatGroupLabel(grp.key)}</div>
              <div className="space-y-3">
                {grp.orders.map((o) => orderCard(o))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => orderCard(o))}
        </div>
      )}
    </div>
  )
}


