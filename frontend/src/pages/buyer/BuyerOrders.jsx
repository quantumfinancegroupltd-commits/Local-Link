import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { StatusTimeline } from '../../components/ui/StatusTimeline.jsx'
import { buildDeliveryTimeline } from '../../lib/statusTimelines.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function BuyerOrders() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tracking, setTracking] = useState({}) // deliveryId -> { latest, trail }
  const [trackingOpen, setTrackingOpen] = useState({}) // deliveryId -> boolean
  const [deliveryMetrics, setDeliveryMetrics] = useState({}) // deliveryId -> metrics

  const [cancelBusyId, setCancelBusyId] = useState(null)
  const [cancelError, setCancelError] = useState(null)

  const [disputeOrderId, setDisputeOrderId] = useState(null)
  const [disputeScope, setDisputeScope] = useState('order')
  const [disputeReason, setDisputeReason] = useState('wrong_item')
  const [disputeDetails, setDisputeDetails] = useState('')
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState([])
  const [disputeBusy, setDisputeBusy] = useState(false)
  const [disputeError, setDisputeError] = useState(null)
  const [disputeOk, setDisputeOk] = useState(null)

  const [tab, setTab] = useState('active') // active | pending | confirmed | dispatched | delivered | cancelled | all
  const [query, setQuery] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

  function timeAgoShort(ts) {
    const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime()
    if (!Number.isFinite(t)) return null
    const mins = Math.floor((Date.now() - t) / (60 * 1000))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  function etaRangeLabel(minutes) {
    const m = Number(minutes)
    if (!Number.isFinite(m) || m <= 0) return null
    const lo = Math.max(5, Math.round((m * 0.8) / 5) * 5)
    const hi = Math.max(lo + 5, Math.round((m * 1.2) / 5) * 5)
    return `ETA ${lo}–${hi} min`
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/orders')
        if (!cancelled) setOrders(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load orders')
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
    const allowed = new Set(['active', 'pending', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'all'])
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

  const counts = useMemo(() => {
    const c = { all: orders.length, active: 0, pending: 0, confirmed: 0, dispatched: 0, delivered: 0, cancelled: 0 }
    for (const o of orders) {
      const s = String(o?.order_status ?? 'pending')
      if (s in c) c[s] += 1
      if (s !== 'cancelled') c.active += 1
    }
    return c
  }, [orders])

  const filteredOrders = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    return orders.filter((o) => {
      const s = String(o?.order_status ?? 'pending')
      const matchTab =
        tab === 'all'
          ? true
          : tab === 'active'
            ? s !== 'cancelled'
            : s === tab
      if (!matchTab) return false
      if (!q) return true
      const hay = `${o?.product_name ?? ''} ${o?.order_status ?? ''} ${o?.payment_status ?? ''} ${o?.delivery_status ?? ''} ${o?.delivery_address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [orders, tab, query])

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
      const rows = Array.isArray(filteredOrders) ? filteredOrders : []
      if (!rows.length) return toast.warning('Nothing to export', 'No orders match the current filter.')
      const header = [
        'order_id',
        'order_status',
        'payment_status',
        'produce_escrow_status',
        'delivery_id',
        'delivery_status',
        'product_name',
        'quantity',
        'total_price',
        'delivery_fee',
        'delivery_address',
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
            csvCell(o?.delivery_id),
            csvCell(o?.delivery_status),
            csvCell(o?.product_name),
            csvCell(o?.quantity),
            csvCell(o?.total_price),
            csvCell(o?.delivery_fee),
            csvCell(o?.delivery_address),
            csvCell(o?.created_at),
          ].join(','),
        )
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `buyer_orders_${String(tab || 'all')}_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Exported CSV.')
    } catch (e) {
      toast.error('Export failed', e?.message ?? 'Unable to export CSV')
    } finally {
      setExportBusy(false)
    }
  }

  // Load delivery metrics (ETA/distance/progress) for visible deliveries.
  useEffect(() => {
    let cancelled = false
    async function loadMetrics() {
      const ids = Array.from(
        new Set(
          filteredOrders
            .map((o) => o.delivery_id)
            .filter(Boolean)
            .slice(0, 20),
        ),
      )
      if (!ids.length) return
      try {
        const results = await Promise.all(
          ids.map((id) =>
            http
              .get(`/deliveries/${id}/metrics`)
              .then((r) => ({ id, data: r.data }))
              .catch(() => null),
          ),
        )
        if (cancelled) return
        setDeliveryMetrics((prev) => {
          const next = { ...prev }
          for (const r of results) {
            if (r?.id && r.data) next[r.id] = r.data
          }
          return next
        })
      } catch {
        // ignore
      }
    }
    loadMetrics()
    return () => {
      cancelled = true
    }
  }, [filteredOrders])

  async function confirmDelivery(deliveryId) {
    await http.post(`/deliveries/${deliveryId}/confirm`, { ok: true })
    const res = await http.get('/orders')
    setOrders(Array.isArray(res.data) ? res.data : [])
  }

  async function payNow(orderId) {
    const ok = window.confirm('Proceed to Paystack to pay for this order?')
    if (!ok) return
    const res = await http.post(`/orders/${orderId}/pay`)
    const url = res.data?.paystack?.authorization_url
    if (!url) throw new Error('Paystack did not return an authorization URL')
    window.location.assign(url)
  }

  async function cancelOrder(orderId) {
    if (!window.confirm('Cancel this order? If pickup hasn’t started, your funds will be refunded.')) return
    setCancelBusyId(orderId)
    setCancelError(null)
    try {
      await http.post(`/orders/${orderId}/cancel`)
      const res = await http.get('/orders')
      setOrders(Array.isArray(res.data) ? res.data : [])
      if (disputeOrderId === orderId) setDisputeOrderId(null)
    } catch (err) {
      setCancelError(err?.response?.data?.message ?? err?.message ?? 'Failed to cancel order')
    } finally {
      setCancelBusyId(null)
    }
  }

  async function openOrderDispute(order) {
    setDisputeOrderId(order.id)
    setDisputeScope('order')
    setDisputeReason('wrong_item')
    setDisputeDetails('')
    setDisputeEvidenceFiles([])
    setDisputeError(null)
    setDisputeOk(null)
  }

  async function submitOrderDispute(orderId) {
    setDisputeBusy(true)
    setDisputeError(null)
    setDisputeOk(null)
    try {
      let evidence = null
      if (disputeEvidenceFiles.length) {
        const uploaded = await uploadMediaFiles(disputeEvidenceFiles)
        const urls = uploaded.map((f) => f.url).filter(Boolean)
        evidence = urls.length ? { files: urls } : null
      }
      await http.post(`/escrow/orders/${orderId}/dispute`, {
        scope: disputeScope,
        reason: disputeReason,
        details: disputeDetails || null,
        evidence,
      })
      setDisputeOk('Dispute opened. An admin will review it.')
    } catch (err) {
      setDisputeError(err?.response?.data?.message ?? err?.message ?? 'Failed to open dispute')
    } finally {
      setDisputeBusy(false)
    }
  }

  async function refreshTracking(deliveryId) {
    const res = await http.get(`/deliveries/${deliveryId}/location`)
    setTracking((m) => ({ ...m, [deliveryId]: res.data }))
  }

  const openDeliveryIds = useMemo(
    () => Object.entries(trackingOpen).filter(([, v]) => v).map(([k]) => k),
    [trackingOpen],
  )

  // Auto-refresh tracking while the panel is open
  useEffect(() => {
    let cancelled = false
    if (openDeliveryIds.length === 0) return

    const intervalMs = 10_000
    const tick = async () => {
      for (const id of openDeliveryIds.slice(0, 5)) {
        try {
          const res = await http.get(`/deliveries/${id}/location`)
          if (cancelled) return
          setTracking((m) => ({ ...m, [id]: res.data }))
        } catch {
          // ignore polling errors
        }
      }
    }

    // initial refresh
    tick()
    const t = setInterval(tick, intervalMs)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [openDeliveryIds])

  return (
    <div className="space-y-6">
      <PageHeader
        title="My orders"
        subtitle="Track produce orders and delivery status (LocalLink Dispatch)."
        actions={
          <>
            <Link to="/marketplace">
              <Button>Browse produce</Button>
            </Link>
            <Button variant="secondary" onClick={() => copyCurrentLink().catch(() => {})}>
              Copy link
            </Button>
            <Button variant="secondary" disabled={exportBusy} onClick={() => exportCsv().catch(() => {})}>
              {exportBusy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div className="text-xs font-semibold text-slate-700">Search</div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="tomatoes, delivered, failed, Accra…" />
          </div>
          <div className="md:col-span-3">
            <div className="text-xs font-semibold text-slate-700">Status</div>
            <Select value={tab} onChange={(e) => setTab(e.target.value)}>
              <option value="active">Active ({counts.active})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="confirmed">Confirmed ({counts.confirmed})</option>
              <option value="dispatched">Dispatched ({counts.dispatched})</option>
              <option value="delivered">Delivered ({counts.delivered})</option>
              <option value="cancelled">Cancelled ({counts.cancelled})</option>
              <option value="all">All ({counts.all})</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button
              variant="secondary"
              onClick={() => {
                setTab('active')
                setQuery('')
              }}
            >
              Clear
            </Button>
          </div>
          <div className="md:col-span-12 text-xs text-slate-500">
            Showing {filteredOrders.length}/{orders.length || 0}
          </div>
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
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Browse the marketplace to place your first order."
          actions={
            <Link to="/marketplace">
              <Button>Browse produce</Button>
            </Link>
          }
        />
      ) : (
        <Card className="p-0">
          {cancelError ? <div className="border-b px-5 py-3 text-sm text-red-700">{cancelError}</div> : null}
          <div className="divide-y">
            {filteredOrders.map((o) => (
              <div key={o.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">{o.product_name || 'Order'}</div>
                      <StatusPill status={o.payment_status || 'pending'} label={`payment: ${o.payment_status || 'pending'}`} />
                      <StatusPill status={o.order_status || 'created'} label={o.order_status || 'order'} />
                      <StatusPill status={o.delivery_status || 'created'} label={`delivery: ${o.delivery_status || 'created'}`} />
                    </div>
                    {(() => {
                      const deliveryStatus = String(o.delivery_status || 'created')
                      const orderStatus = String(o.order_status || 'created')
                      const paymentStatus = String(o.payment_status || 'pending')
                      const produceEscrowStatus = String(o.produce_escrow_status || '')
                      const disputeStatus = String(o.produce_dispute_status || '')

                      if (produceEscrowStatus === 'disputed') {
                        const statusLabel = disputeStatus === 'open' ? 'Open' : disputeStatus === 'under_review' ? 'Under review' : disputeStatus === 'resolved' ? 'Resolved' : disputeStatus || 'Disputed'
                        const desc =
                          disputeStatus === 'open'
                            ? 'Admin will review shortly. No action needed.'
                            : disputeStatus === 'under_review'
                              ? 'Admin is reviewing. You’ll be notified when resolved.'
                              : disputeStatus === 'resolved'
                                ? 'Resolved. Funds released per admin decision.'
                                : 'Escrow is frozen while the dispute is reviewed.'
                        return (
                          <NextStepBanner
                            className="mt-3"
                            variant="warning"
                            title={`Dispute: ${statusLabel}`}
                            description={desc}
                          />
                        )
                      }

                      if (orderStatus === 'cancelled') {
                        return (
                          <NextStepBanner
                            className="mt-3"
                            variant="danger"
                            title="Order cancelled"
                            description="This order is closed. If escrow was held, it will be refunded unless there is an active dispute."
                          />
                        )
                      }

                      if (paymentStatus !== 'paid') {
                        return (
                          <NextStepBanner
                            className="mt-3"
                            variant={paymentStatus === 'failed' ? 'danger' : 'warning'}
                            title={paymentStatus === 'failed' ? 'Payment failed' : 'Next: pay to confirm this order'}
                            description="Your order will be confirmed after payment succeeds."
                            actions={
                              <Button variant="secondary" onClick={() => payNow(o.id)}>
                                Pay now
                              </Button>
                            }
                          />
                        )
                      }

                      if (deliveryStatus === 'delivered') {
                        return (
                          <NextStepBanner
                            className="mt-3"
                            variant="warning"
                            title="Next: confirm delivery"
                            description="Confirm delivery to complete the order and release funds."
                            actions={
                              <Button variant="secondary" onClick={() => confirmDelivery(o.delivery_id)}>
                                Confirm delivery
                              </Button>
                            }
                          />
                        )
                      }

                      if (deliveryStatus === 'confirmed') {
                        const farmerReviewed = o?.farmer_reviewed === true
                        return (
                          <NextStepBanner
                            className="mt-3"
                            variant="success"
                            title="Next: leave a review"
                            description="Reviews build trust for farmers and drivers."
                            actions={
                              farmerReviewed ? (
                                <Button variant="secondary" disabled title="Already reviewed">
                                  Farmer reviewed
                                </Button>
                              ) : (
                                <Link to={`/reviews/leave?kind=order&id=${encodeURIComponent(o.id)}&target=farmer`}>
                                  <Button variant="secondary">Rate farmer</Button>
                                </Link>
                              )
                            }
                          />
                        )
                      }

                      if (['picked_up', 'on_the_way'].includes(deliveryStatus)) {
                        const canTrack = ['picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(o.delivery_status)
                        return (
                          <NextStepBanner
                            className="mt-3"
                            title="Next: track delivery"
                            description="You’ll see live location once the driver shares it."
                            actions={
                              o.delivery_id ? (
                                <Button
                                  variant="secondary"
                                  onClick={async () => {
                                    const next = !trackingOpen[o.delivery_id]
                                    setTrackingOpen((m) => ({ ...m, [o.delivery_id]: next }))
                                    if (next) await refreshTracking(o.delivery_id)
                                  }}
                                  disabled={!canTrack}
                                >
                                  {trackingOpen[o.delivery_id] ? 'Hide tracking' : 'Track delivery'}
                                </Button>
                              ) : null
                            }
                          />
                        )
                      }

                      if (['created', 'driver_assigned'].includes(deliveryStatus)) {
                        return (
                          <NextStepBanner
                            className="mt-3"
                            title="Next: waiting for pickup"
                            description="A driver will pick up your order soon. You can cancel before pickup starts."
                          />
                        )
                      }

                      return null
                    })()}
                    <div className="mt-3">
                      {(() => {
                        const m = deliveryMetrics[o.delivery_id]
                        const progress01 = m?.progress01
                        const km = m?.using_live_location ? m?.distance_km_remaining : m?.distance_km_total
                        const eta = m?.using_live_location ? m?.eta_minutes_remaining : m?.eta_minutes_total
                        const labelParts = []
                        const etaLabel = etaRangeLabel(eta)
                        if (etaLabel) labelParts.push(etaLabel)
                        if (km != null) labelParts.push(`${Number(km).toFixed(1)} km`)
                        const label = labelParts.length ? labelParts.join(' • ') : null
                        const driverState =
                          !o.driver_user_id
                            ? { text: 'Driver: not assigned yet', tone: 'text-slate-600' }
                            : m?.driver_is_online === true
                              ? { text: 'Driver: online', tone: 'text-emerald-700' }
                              : m?.driver_is_online === false
                                ? { text: 'Driver: offline', tone: 'text-amber-700' }
                                : { text: 'Driver: assigned', tone: 'text-slate-700' }

                        const lastGps = m?.last_location_at ? timeAgoShort(m.last_location_at) : null

                        return (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                              <span className={['font-semibold', driverState.tone].join(' ')}>{driverState.text}</span>
                              {o.driver_user_id ? (
                                <span className={lastGps ? 'text-slate-600' : 'text-slate-500'}>
                                  {lastGps ? `GPS: ${lastGps}` : 'GPS: waiting for updates'}
                                </span>
                              ) : null}
                              {m?.using_live_location ? <span className="text-slate-500">• Live tracking on</span> : null}
                            </div>
                            <StatusTimeline
                              layout="horizontal"
                              compact
                              progressValue={typeof progress01 === 'number' ? progress01 : undefined}
                              progressLabel={label}
                              steps={buildDeliveryTimeline(o.delivery_status || 'created', o.order_status || 'created').steps}
                            />
                          </div>
                        )
                      })()}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Qty: {o.quantity} • Total: GHS {Number(o.total_price ?? 0).toFixed(0)} • Delivery fee: GHS{' '}
                      {Number(o.delivery_fee ?? 0).toFixed(0)}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 truncate">Delivery to: {o.delivery_address || '—'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {o.delivery_id ? (
                      <>
                        <Link to={`/messages/order/${o.id}?with=farmer`}>
                          <Button variant="secondary">Message farmer</Button>
                        </Link>
                        {o.driver_user_id ? (
                          <Link to={`/messages/order/${o.id}?with=driver`}>
                            <Button variant="secondary">Message driver</Button>
                          </Link>
                        ) : null}
                      </>
                    ) : null}

                    {['created', 'driver_assigned'].includes(o.delivery_status || 'created') ? (
                      <Button
                        variant="secondary"
                        onClick={() => cancelOrder(o.id)}
                        disabled={cancelBusyId === o.id || o.order_status === 'cancelled'}
                        title={o.order_status === 'cancelled' ? 'Already cancelled' : ''}
                      >
                        {cancelBusyId === o.id ? 'Cancelling…' : o.order_status === 'cancelled' ? 'Cancelled' : 'Cancel'}
                      </Button>
                    ) : null}

                    {o.delivery_status !== 'confirmed' && o.order_status !== 'cancelled' ? (
                      <Button variant="secondary" onClick={() => openOrderDispute(o)} disabled={disputeBusy}>
                        Dispute
                      </Button>
                    ) : null}

                    {o.delivery_id ? (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const next = !trackingOpen[o.delivery_id]
                          setTrackingOpen((m) => ({ ...m, [o.delivery_id]: next }))
                          if (next) await refreshTracking(o.delivery_id)
                        }}
                        disabled={!['picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(o.delivery_status)}
                        title={
                          ['picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(o.delivery_status)
                            ? ''
                            : 'Tracking starts once the driver has picked up the order.'
                        }
                      >
                        {trackingOpen[o.delivery_id] ? 'Hide tracking' : 'Track delivery'}
                      </Button>
                    ) : null}

                    {o.delivery_status === 'delivered' ? (
                      <Button variant="secondary" onClick={() => confirmDelivery(o.delivery_id)}>
                        Confirm delivery
                      </Button>
                    ) : o.delivery_status === 'confirmed' ? (
                      <>
                        {o?.farmer_reviewed === true ? (
                          <Button variant="secondary" disabled title="Already reviewed">
                            Farmer reviewed
                          </Button>
                        ) : (
                          <Link to={`/reviews/leave?kind=order&id=${encodeURIComponent(o.id)}&target=farmer`}>
                            <Button variant="secondary">Rate farmer</Button>
                          </Link>
                        )}
                        {o.driver_user_id ? (
                          o?.driver_reviewed === true ? (
                            <Button variant="secondary" disabled title="Already reviewed">
                              Driver reviewed
                            </Button>
                          ) : (
                            <Link to={`/reviews/leave?kind=order&id=${encodeURIComponent(o.id)}&target=driver`}>
                              <Button variant="secondary">Rate driver</Button>
                            </Link>
                          )
                        ) : null}
                      </>
                    ) : null}

                    <Link to={`/marketplace/products/${o.product_id}`}>
                      <Button variant="secondary">View product</Button>
                    </Link>
                  </div>
                </div>

                {disputeOrderId === o.id ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">Open a dispute</div>
                        <div className="mt-1 text-xs text-slate-600">
                          This freezes escrow for admin review. Include evidence for faster resolution.
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setDisputeOrderId(null)
                          setDisputeError(null)
                          setDisputeOk(null)
                        }}
                        disabled={disputeBusy}
                      >
                        Close
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Scope</Label>
                        <Select value={disputeScope} onChange={(e) => setDisputeScope(e.target.value)} disabled={disputeBusy}>
                          <option value="order">Order (freeze all)</option>
                          <option value="produce">Produce</option>
                          <option value="delivery">Delivery</option>
                        </Select>
                      </div>
                      <div>
                        <Label>Reason</Label>
                        <Select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} disabled={disputeBusy}>
                          <option value="wrong_item">Wrong item</option>
                          <option value="late_delivery">Late delivery</option>
                          <option value="poor_quality">Poor quality</option>
                          <option value="communication_issue">Communication issue</option>
                          <option value="other">Other</option>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label>Details (optional)</Label>
                      <Textarea
                        value={disputeDetails}
                        onChange={(e) => setDisputeDetails(e.target.value)}
                        rows={3}
                        placeholder="Describe what happened…"
                        disabled={disputeBusy}
                      />
                    </div>

                    <div className="mt-4">
                      <Label>Evidence (optional)</Label>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                        <div className="font-semibold">Evidence checklist (recommended)</div>
                        <ul className="mt-2 space-y-1">
                          <li>- Photos/videos of the item received (wrong/poor quality)</li>
                          <li>- Packaging label + quantity proof (scale/photo)</li>
                          <li>- Delivery issue proof (late, wrong dropoff, damage)</li>
                          <li>- Chat context (keep it in-app)</li>
                        </ul>
                        <div className="mt-2 text-slate-600">
                          Tip: include the clearest 2–4 photos first.
                        </div>
                      </div>
                      <Input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => setDisputeEvidenceFiles(Array.from(e.target.files ?? []))}
                        disabled={disputeBusy}
                      />
                      <div className="mt-2 text-xs text-slate-500">Upload photos/videos (max 50MB per file).</div>
                      {disputeEvidenceFiles.length ? (
                        <div className="mt-2 text-xs text-slate-600">
                          Selected: {disputeEvidenceFiles.map((f) => f.name).slice(0, 6).join(', ')}
                          {disputeEvidenceFiles.length > 6 ? ` (+${disputeEvidenceFiles.length - 6} more)` : ''}
                        </div>
                      ) : null}
                    </div>

                    {disputeError ? <div className="mt-3 text-sm text-red-700">{disputeError}</div> : null}
                    {disputeOk ? <div className="mt-3 text-sm text-emerald-700">{disputeOk}</div> : null}

                    <div className="mt-4">
                      <Button variant="secondary" onClick={() => submitOrderDispute(o.id)} disabled={disputeBusy}>
                        {disputeBusy ? 'Submitting…' : 'Submit dispute'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {o.delivery_id && trackingOpen[o.delivery_id] ? (
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold">Live location</div>
                      <Button variant="secondary" onClick={() => refreshTracking(o.delivery_id)}>
                        Refresh
                      </Button>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Auto-refreshing every 10 seconds.</div>
                    {(() => {
                      const data = tracking[o.delivery_id]
                      const latest = data?.latest
                      const coords = latest ? `${latest.lat},${latest.lng}` : null
                      const mapsLink = coords
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coords)}`
                        : null
                      const embed = coords
                        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}&output=embed`
                        : null
                      const ago = latest?.created_at ? new Date(latest.created_at).toLocaleTimeString() : null
                      return !coords ? (
                        <div className="mt-2 text-sm text-slate-600">
                          No live location yet. Ask the driver to tap “Share live location”.
                        </div>
                      ) : (
                        <>
                          <div className="mt-2 text-xs text-slate-600">Last update: {ago}</div>
                          <div className="mt-3 overflow-hidden rounded-2xl border bg-white">
                            <iframe
                              title="Driver location"
                              src={embed}
                              className="h-56 w-full"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                          {mapsLink ? (
                            <div className="mt-2 text-xs text-slate-600">
                              <a className="underline" href={mapsLink} target="_blank" rel="noreferrer">
                                Open in Google Maps
                              </a>
                            </div>
                          ) : null}
                        </>
                      )
                    })()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}


