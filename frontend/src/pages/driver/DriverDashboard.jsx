import { useEffect, useMemo, useRef, useState } from 'react'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { StatusTimeline } from '../../components/ui/StatusTimeline.jsx'
import { buildDeliveryTimeline } from '../../lib/statusTimelines.js'
import { VerifyAccountBanner } from '../../components/verification/VerifyAccountBanner.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast.jsx'

export function DriverDashboard() {
  const toast = useToast()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [profile, setProfile] = useState(null)
  const [vehicleType, setVehicleType] = useState('bike')
  const [area, setArea] = useState('')
  const [radiusKm, setRadiusKm] = useState(10)
  const [onlineBusy, setOnlineBusy] = useState(false)
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)

  const [deliveries, setDeliveries] = useState([])
  const [availableDeliveries, setAvailableDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [claimBusyId, setClaimBusyId] = useState(null)
  const [availableError, setAvailableError] = useState(null)
  const [deliveriesTab, setDeliveriesTab] = useState('active') // active | completed | paid | disputed | all
  const [deliveriesQuery, setDeliveriesQuery] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

  const [summary, setSummary] = useState(null)
  const [trackingId, setTrackingId] = useState(null)
  const [trackingError, setTrackingError] = useState(null)
  const watchIdRef = useRef(null)
  const [deliveryMetrics, setDeliveryMetrics] = useState({}) // deliveryId -> metrics

  const currency = summary?.currency ?? 'GHS'
  const available = useMemo(() => Number(summary?.available_balance ?? 0), [summary])
  const pending = useMemo(() => Number(summary?.pending_escrow ?? 0), [summary])
  const hasDriverProfile = Boolean(profile)
  const isApproved = profile?.status === 'approved'
  const isOnline = Boolean(profile?.is_online)

  const deliveriesCounts = useMemo(() => {
    const list = Array.isArray(deliveries) ? deliveries : []
    const counts = { all: list.length, active: 0, completed: 0, paid: 0, disputed: 0 }
    for (const d of list) {
      const s = String(d?.status || 'created')
      const escrow = String(d?.delivery_escrow_status || '')
      const dispute = String(d?.delivery_dispute_status || '')
      const isDisputed = escrow === 'disputed' || dispute === 'open' || dispute === 'under_review'
      const isPaid = escrow === 'released'
      const isCompleted = s === 'delivered' || s === 'confirmed'
      const isActive = !isCompleted
      if (isActive) counts.active += 1
      if (isCompleted) counts.completed += 1
      if (isPaid) counts.paid += 1
      if (isDisputed) counts.disputed += 1
    }
    return counts
  }, [deliveries])

  const filteredDeliveries = useMemo(() => {
    const list = Array.isArray(deliveries) ? deliveries : []
    const q = String(deliveriesQuery || '').trim().toLowerCase()
    return list.filter((d) => {
      const s = String(d?.status || 'created')
      const escrow = String(d?.delivery_escrow_status || '')
      const dispute = String(d?.delivery_dispute_status || '')
      const isDisputed = escrow === 'disputed' || dispute === 'open' || dispute === 'under_review'
      const isPaid = escrow === 'released'
      const isCompleted = s === 'delivered' || s === 'confirmed'
      const isActive = !isCompleted

      if (deliveriesTab === 'active' && !isActive) return false
      if (deliveriesTab === 'completed' && !isCompleted) return false
      if (deliveriesTab === 'paid' && !isPaid) return false
      if (deliveriesTab === 'disputed' && !isDisputed) return false

      if (!q) return true
      const hay = `${d?.order_id ?? ''} ${d?.pickup_location ?? ''} ${d?.dropoff_location ?? ''} ${d?.delivery_address ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [deliveries, deliveriesQuery, deliveriesTab])

  useEffect(() => {
    const nextTab = String(searchParams.get('tab') || '').trim()
    const nextQ = String(searchParams.get('q') || '')
    const allowed = new Set(['active', 'completed', 'paid', 'disputed', 'all'])
    if (nextTab && allowed.has(nextTab) && nextTab !== deliveriesTab) setDeliveriesTab(nextTab)
    if (nextQ !== deliveriesQuery) setDeliveriesQuery(nextQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const t0 = String(deliveriesTab || '').trim()
      const q0 = String(deliveriesQuery || '').trim()
      if (t0) next.set('tab', t0)
      else next.delete('tab')
      if (q0) next.set('q', q0)
      else next.delete('q')
      if (String(next.toString()) !== String(searchParams.toString())) setSearchParams(next, { replace: true })
    }, 250)
    return () => clearTimeout(t)
  }, [deliveriesTab, deliveriesQuery, searchParams, setSearchParams])

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
      const rows = Array.isArray(filteredDeliveries) ? filteredDeliveries : []
      if (!rows.length) return toast.warning('Nothing to export', 'No deliveries match the current filter.')
      const header = [
        'delivery_id',
        'order_id',
        'delivery_status',
        'pickup_location',
        'dropoff_location',
        'fee',
        'delivery_escrow_status',
        'delivery_escrow_amount',
        'delivery_dispute_status',
        'delivery_dispute_reason',
        'created_at',
      ]
      const lines = [header.join(',')]
      for (const d of rows) {
        lines.push(
          [
            csvCell(d?.id),
            csvCell(d?.order_id),
            csvCell(d?.status),
            csvCell(d?.pickup_location),
            csvCell(d?.dropoff_location ?? d?.delivery_address),
            csvCell(d?.fee ?? d?.delivery_fee),
            csvCell(d?.delivery_escrow_status),
            csvCell(d?.delivery_escrow_amount),
            csvCell(d?.delivery_dispute_status),
            csvCell(d?.delivery_dispute_reason),
            csvCell(d?.created_at),
          ].join(','),
        )
      }
      const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'driver-deliveries.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export ready', `Downloaded ${rows.length} deliver${rows.length === 1 ? 'y' : 'ies'}.`)
    } catch (e) {
      toast.error('Export failed', e?.message ?? 'Unable to export CSV')
    } finally {
      setExportBusy(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [d, s, prof] = await Promise.all([
          http.get('/deliveries/me'),
          http.get('/wallets/summary'),
          http.get('/drivers/me').catch(() => ({ data: null })),
        ])
        if (cancelled) return
        setDeliveries(Array.isArray(d.data) ? d.data : [])
        setSummary(s.data ?? null)
        setProfile(prof.data ?? null)
        if (prof.data?.vehicle_type) setVehicleType(prof.data.vehicle_type)
        if (prof.data?.area_of_operation) setArea(prof.data.area_of_operation)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load driver dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshAvailable() {
    setAvailableError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('radius_km', String(radiusKm || 10))
      if (area) qs.set('area', String(area))
      const r = await http.get(`/deliveries/available?${qs.toString()}`)
      setAvailableDeliveries(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setAvailableError(e?.response?.data?.message ?? e?.message ?? 'Unable to load available deliveries')
      setAvailableDeliveries([])
    }
  }

  // Load available deliveries for claim (dispatch layer)
  useEffect(() => {
    if (!profile || profile?.status !== 'approved') {
      setAvailableDeliveries([])
      return
    }
    refreshAvailable().catch(() => {})
    const t = setInterval(() => refreshAvailable().catch(() => {}), 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.status, radiusKm, area, profile?.is_online])

  // Load deterministic ETA/distance/progress for current deliveries
  useEffect(() => {
    let cancelled = false
    async function loadMetrics() {
      const ids = Array.from(new Set((deliveries ?? []).map((d) => d.id).filter(Boolean).slice(0, 20)))
      if (!ids.length) return
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
    }
    loadMetrics().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [deliveries])

  async function refresh() {
    const d = await http.get('/deliveries/me')
    setDeliveries(Array.isArray(d.data) ? d.data : [])
    const s = await http.get('/wallets/summary')
    setSummary(s.data ?? null)
    await refreshAvailable()
  }

  async function updateStatus(deliveryId, action) {
    setBusyId(deliveryId)
    try {
      await http.post(`/deliveries/${deliveryId}/${action}`)
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function claimDelivery(deliveryId) {
    setClaimBusyId(deliveryId)
    try {
      await http.post(`/deliveries/${deliveryId}/claim`)
      await refresh()
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to claim delivery')
    } finally {
      setClaimBusyId(null)
    }
  }

  async function startTracking(deliveryId) {
    setTrackingError(null)
    if (!navigator.geolocation) {
      setTrackingError('Geolocation not supported in this browser.')
      return
    }
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTrackingId(deliveryId)

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await http.post(`/deliveries/${deliveryId}/location`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
        } catch {
          // silently ignore occasional failures
        }
      },
      (err) => {
        setTrackingError(err?.message || 'Location permission denied')
        setTrackingId(null)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
  }

  function stopTracking() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setTrackingId(null)
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  async function saveProfile() {
    setProfileBusy(true)
    setProfileMsg(null)
    try {
      const res = await http.post('/drivers/me', { vehicle_type: vehicleType, area_of_operation: area || null })
      setProfile(res.data)
      setProfileMsg('Profile submitted. Waiting for admin approval.')
    } catch (err) {
      setProfileMsg(err?.response?.data?.message ?? err?.message ?? 'Failed to save profile')
    } finally {
      setProfileBusy(false)
    }
  }

  async function goOnline() {
    setOnlineBusy(true)
    setError(null)
    try {
      if (!navigator.geolocation) throw new Error('Geolocation not supported in this browser.')
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 })
      })
      const res = await http.post('/drivers/me/location', {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      })
      setProfile(res.data)
      await refreshAvailable()
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to go online')
    } finally {
      setOnlineBusy(false)
    }
  }

  async function goOffline() {
    setOnlineBusy(true)
    setError(null)
    try {
      const res = await http.post('/drivers/me', { is_online: false })
      setProfile(res.data)
      setAvailableDeliveries([])
      setAvailableError(null)
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to go offline')
    } finally {
      setOnlineBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Dashboard"
        title="Driver Dashboard"
        subtitle={`Hi${user?.name ? ` ${user.name}` : ''} — manage deliveries and earnings.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Top
            </Button>
            <Button variant="secondary" onClick={() => document.getElementById('deliveries')?.scrollIntoView({ behavior: 'smooth' })}>
              Deliveries
            </Button>
          </>
        }
      />

      <VerifyAccountBanner />

      {!hasDriverProfile ? (
        <NextStepBanner
          variant="warning"
          title="Step 1: Create your driver profile"
          description="Add your vehicle type and operating area, then submit. Admin will review and approve before you can claim deliveries."
          actions={
            <Button
              variant="secondary"
              onClick={() => document.getElementById('driver-profile')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
            >
              Complete driver profile below
            </Button>
          }
        />
      ) : profile?.status === 'pending' ? (
        <NextStepBanner
          variant="info"
          title="Step 2: Waiting for admin approval"
          description="Admin will review your profile shortly. Once approved, you'll be able to go online and claim deliveries. You'll be notified when approved."
        />
      ) : isApproved && !isOnline ? (
        <NextStepBanner
          title="Step 3: Go online to receive deliveries"
          description="Turn on GPS and go online to see nearby pickups and claim deliveries."
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <div className="text-xs text-slate-600">Available balance</div>
          <div className="mt-1 text-2xl font-bold">
            {currency} {available.toFixed(0)}
          </div>
          <div className="mt-1 text-xs text-slate-600">Withdrawals are enabled in Seller Dashboard (Wallet → Payouts).</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-600">Pending (Escrow)</div>
          <div className="mt-1 text-2xl font-bold">
            {currency} {pending.toFixed(0)}
          </div>
          <div className="mt-1 text-xs text-slate-600">Delivery fees in progress</div>
        </Card>
      </div>

      <Card id="driver-profile">
        <div className="text-sm font-semibold">Driver profile</div>
        <div className="mt-2 text-sm text-slate-600">
          Status:{' '}
          <span className="font-semibold text-slate-900">{profile?.status ?? 'not set (submit below)'}</span>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          Online:{' '}
          <span className="font-semibold text-slate-900">{profile?.is_online ? 'Yes' : 'No'}</span>
          {profile?.last_location_at ? (
            <span className="ml-2 text-xs text-slate-500">• last GPS: {new Date(profile.last_location_at).toLocaleTimeString()}</span>
          ) : null}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <Label>Vehicle type</Label>
            <Select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              <option value="bike">Bike / Okada</option>
              <option value="car">Car</option>
              <option value="van">Van</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Area of operation</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Accra (Osu, East Legon)" />
          </div>
        </div>
        {profileMsg ? <div className="mt-3 text-sm text-slate-700">{profileMsg}</div> : null}
        <div className="mt-3">
          <Button variant="secondary" disabled={profileBusy} onClick={saveProfile}>
            {profileBusy ? 'Saving…' : 'Submit / Update'}
          </Button>
          {profile?.status === 'approved' ? (
            <span className="ml-2">
              {profile?.is_online ? (
                <Button variant="secondary" disabled={onlineBusy} onClick={goOffline}>
                  {onlineBusy ? 'Working…' : 'Go offline'}
                </Button>
              ) : (
                <Button disabled={onlineBusy} onClick={goOnline}>
                  {onlineBusy ? 'Getting location…' : 'Go online'}
                </Button>
              )}
            </span>
          ) : null}
        </div>
      </Card>

      {profile?.status !== 'approved' ? (
        <NextStepBanner
          variant="warning"
          title="Waiting for approval"
          description="To protect buyers, farmers and florists, drivers must be approved before they can claim deliveries. Ask an admin to approve your driver account."
        />
      ) : (
      <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Available deliveries</div>
              <div className="mt-1 text-xs text-slate-600">Go online (GPS) to see nearby pickups. Claim to earn delivery fees.</div>
            </div>
            <Button variant="secondary" onClick={refreshAvailable}>
              Refresh
            </Button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div>
              <Label>Radius</Label>
              <Select value={String(radiusKm)} onChange={(e) => setRadiusKm(Number(e.target.value))} disabled={!profile?.is_online}>
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="25">25 km</option>
                <option value="50">50 km</option>
              </Select>
              {!profile?.is_online ? <div className="mt-1 text-xs text-slate-500">Go online to enable radius filtering.</div> : null}
            </div>
            <div className="md:col-span-2">
              <Label>Area filter</Label>
              <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Osu, East Legon" />
            </div>
          </div>

          {availableError ? (
            <div className="mt-3 text-sm text-amber-700">{availableError}</div>
          ) : availableDeliveries.length === 0 ? (
            <div className="mt-3 text-sm text-slate-600">No available deliveries right now.</div>
          ) : (
            <div className="mt-3 divide-y">
              {availableDeliveries.map((d) => (
                <div key={d.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Order {d.order_id?.slice(0, 8)}</div>
                      <div className="mt-1 text-xs text-slate-600">Pickup: {d.pickup_location || '—'}</div>
                      <div className="mt-1 text-xs text-slate-600">Dropoff: {d.dropoff_location || d.delivery_address || '—'}</div>
                      {d.distance_km_to_pickup != null ? (
                        <div className="mt-1 text-xs text-slate-600">
                          Distance to pickup:{' '}
                          <span className="font-semibold text-slate-800">{Number(d.distance_km_to_pickup).toFixed(1)} km</span>
                        </div>
                      ) : null}
                      <div className="mt-2 text-xs text-slate-600">
                        {d.product_name ? (
                          <>
                            Item: <span className="font-semibold text-slate-800">{d.product_name}</span>
                            {d.product_category ? <span className="text-slate-500"> • {d.product_category}</span> : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-slate-900">Fee: {currency} {Number(d.fee ?? d.delivery_fee ?? 0).toFixed(0)}</div>
                      <Button disabled={claimBusyId === d.id} onClick={() => claimDelivery(d.id)}>
                        {claimBusyId === d.id ? 'Claiming…' : 'Claim'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card id="deliveries">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">My deliveries</div>
            <div className="mt-1 text-xs text-slate-600">Pipeline view of your active work, completed drops, paid fees and disputes.</div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <div className="w-full md:w-64">
              <Input value={deliveriesQuery} onChange={(e) => setDeliveriesQuery(e.target.value)} placeholder="Search deliveries…" />
            </div>
            <Button size="sm" variant="secondary" onClick={() => copyCurrentLink().catch(() => {})}>
              Copy link
            </Button>
            <Button size="sm" variant="secondary" disabled={exportBusy} onClick={() => exportCsv().catch(() => {})}>
              {exportBusy ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={deliveriesTab === 'active' ? 'primary' : 'secondary'} onClick={() => setDeliveriesTab('active')}>
            Active ({deliveriesCounts.active})
          </Button>
          <Button variant={deliveriesTab === 'completed' ? 'primary' : 'secondary'} onClick={() => setDeliveriesTab('completed')}>
            Completed ({deliveriesCounts.completed})
          </Button>
          <Button variant={deliveriesTab === 'paid' ? 'primary' : 'secondary'} onClick={() => setDeliveriesTab('paid')}>
            Paid ({deliveriesCounts.paid})
          </Button>
          <Button variant={deliveriesTab === 'disputed' ? 'primary' : 'secondary'} onClick={() => setDeliveriesTab('disputed')}>
            Disputed ({deliveriesCounts.disputed})
          </Button>
          <Button variant={deliveriesTab === 'all' ? 'primary' : 'secondary'} onClick={() => setDeliveriesTab('all')}>
            All ({deliveriesCounts.all})
          </Button>
        </div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No deliveries found for this view.</div>
        ) : (
          <div className="mt-3 divide-y">
            {filteredDeliveries.map((d) => (
              <div key={d.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Order {d.order_id?.slice(0, 8)}</div>
                    <div className="mt-1 text-xs text-slate-600">Pickup: {d.pickup_location || '—'}</div>
                    <div className="mt-1 text-xs text-slate-600">Dropoff: {d.dropoff_location || d.delivery_address || '—'}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill status={d.status || 'created'} label={`delivery: ${d.status || 'created'}`} />
                      {d?.delivery_escrow_status ? <StatusPill status={d.delivery_escrow_status} label={`escrow: ${d.delivery_escrow_status}`} /> : null}
                      {d?.delivery_dispute_status ? <StatusPill status={d.delivery_dispute_status} label={`dispute: ${d.delivery_dispute_status}`} /> : null}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    Fee: {currency} {Number(d.fee ?? d.delivery_fee ?? 0).toFixed(0)}
                  </div>
                </div>
                {(() => {
                  const s = String(d.status || 'created')
                  if (s === 'delivered' || s === 'confirmed') {
                    return (
                      <NextStepBanner
                        className="mt-3"
                        variant="success"
                        title="Delivery complete"
                        description="Great job. Keep your status updates accurate — it affects trust."
                      />
                    )
                  }
                  if (s === 'on_the_way') {
                    return (
                      <NextStepBanner
                        className="mt-3"
                        title="Next: reach dropoff and mark delivered"
                        description="Keep sharing live location so the buyer can track you."
                      />
                    )
                  }
                  if (s === 'picked_up') {
                    return (
                      <NextStepBanner
                        className="mt-3"
                        title="Next: tap “On the way” when you leave pickup"
                        description="Sharing live location improves ETA accuracy."
                      />
                    )
                  }
                  if (s === 'driver_assigned' || s === 'created') {
                    return (
                      <NextStepBanner
                        className="mt-3"
                        title="Next: go to pickup and mark “Picked up”"
                        description="Then tap “On the way” and share live location."
                      />
                    )
                  }
                  return null
                })()}
                <div className="mt-3">
                  {(() => {
                    const m = deliveryMetrics[d.id]
                    const progress01 = m?.progress01
                    const km = m?.using_live_location ? m?.distance_km_remaining : m?.distance_km_total
                    const eta = m?.using_live_location ? m?.eta_minutes_remaining : m?.eta_minutes_total
                    const labelParts = []
                    if (eta != null) labelParts.push(`ETA ~${eta} min`)
                    if (km != null) labelParts.push(`${Number(km).toFixed(1)} km`)
                    const label = labelParts.length ? labelParts.join(' • ') : null
                    return (
                      <StatusTimeline
                        layout="horizontal"
                        compact
                        progressValue={typeof progress01 === 'number' ? progress01 : undefined}
                        progressLabel={label}
                        steps={buildDeliveryTimeline(d.status || 'created', 'created').steps}
                      />
                    )
                  })()}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={busyId === d.id || !['created', 'driver_assigned'].includes(d.status)}
                    onClick={() => updateStatus(d.id, 'picked-up')}
                  >
                    Picked up
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busyId === d.id || d.status !== 'picked_up'}
                    onClick={() => updateStatus(d.id, 'on-the-way')}
                  >
                    On the way
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busyId === d.id || d.status !== 'on_the_way'}
                    onClick={() => updateStatus(d.id, 'delivered')}
                  >
                    Delivered
                  </Button>
                  <Button
                    variant={trackingId === d.id ? 'primary' : 'secondary'}
                    disabled={!['driver_assigned', 'picked_up', 'on_the_way'].includes(d.status)}
                    onClick={() => (trackingId === d.id ? stopTracking() : startTracking(d.id))}
                  >
                    {trackingId === d.id ? 'Stop sharing location' : 'Share live location'}
                  </Button>
                </div>
                {trackingError && trackingId === d.id ? (
                  <div className="mt-2 text-sm text-red-700">{trackingError}</div>
                ) : trackingId === d.id ? (
                  <div className="mt-2 text-xs text-slate-600">Sharing live location…</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}


