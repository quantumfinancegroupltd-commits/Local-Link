import { useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http.js'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'

function fmt(x) {
  try {
    return new Date(x).toLocaleString()
  } catch {
    return String(x || '')
  }
}

export function MyShifts() {
  const toast = useToast()
  const { online } = useOnlineStatus()
  const [range, setRange] = useState('upcoming')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [codeByShiftId, setCodeByShiftId] = useState({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await http.get('/corporate/me/shifts', { params: { range, limit: 120 } })
      setItems(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load shifts')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  async function post(action, shiftId, body) {
    if (!online) return toast.warning('Offline', 'Reconnect to continue.')
    const key = `${action}:${shiftId}`
    setBusyKey(key)
    try {
      await http.post(`/corporate/me/shifts/${encodeURIComponent(shiftId)}/${action}`, body ?? undefined)
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Action failed')
    } finally {
      setBusyKey(null)
    }
  }

  async function getBrowserPosition() {
    return await new Promise((resolve, reject) => {
      if (!navigator?.geolocation) return reject(new Error('Geolocation not supported'))
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err || new Error('Failed to get location')),
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
      )
    })
  }

  const grouped = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    // Sort by start time desc (backend already does), but keep stable.
    return list
  }, [items])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Work"
        title="My shifts"
        subtitle="Accept invitations, check in/out, and keep your work history consistent."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="upcoming">Upcoming</option>
              <option value="history">History</option>
              <option value="all">All</option>
            </Select>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {loading ? (
        <Card className="p-5">
          <div className="text-sm text-slate-600">Loading…</div>
        </Card>
      ) : error ? (
        <Card className="p-5">
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : grouped.length === 0 ? (
        <Card className="p-6">
          <div className="text-sm font-semibold text-slate-900">No shifts yet.</div>
          <div className="mt-1 text-sm text-slate-600">When an employer invites you, it will show up here.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map((s) => {
            const status = String(s.status || '')
            const canAccept = status === 'invited'
            const canCheckIn = status === 'accepted' || status === 'checked_in'
            const canCheckOut = status === 'checked_in' || status === 'checked_out' || status === 'completed'
            const checkinRequired = !!s.checkin_required
            const geoRequired = !!s.checkin_geo_required
            const codeValue = String(codeByShiftId?.[s.shift_id] ?? '')
            return (
              <Card key={s.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{s.shift_title ?? 'Shift'}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {s.company_name ?? 'Company'}
                      {s.shift_location ? ` • ${s.shift_location}` : ''}
                      {s.shift_role_tag ? ` • ${s.shift_role_tag}` : ''}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">
                      {fmt(s.start_at)} → {fmt(s.end_at)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">status: {status}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canAccept ? (
                      <>
                        <Button disabled={!online || busyKey === `accept:${s.shift_id}`} onClick={() => post('accept', s.shift_id)}>
                          {busyKey === `accept:${s.shift_id}` ? 'Working…' : 'Accept'}
                        </Button>
                        <Button variant="secondary" disabled={!online || busyKey === `decline:${s.shift_id}`} onClick={() => post('decline', s.shift_id)}>
                          {busyKey === `decline:${s.shift_id}` ? 'Working…' : 'Decline'}
                        </Button>
                      </>
                    ) : null}

                    {canCheckIn ? (
                      status === 'checked_in' ? (
                        <Button variant="secondary" disabled title="Already checked in">
                          Checked in
                        </Button>
                      ) : checkinRequired ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="w-40">
                            <Input
                              value={codeValue}
                              onChange={(e) => setCodeByShiftId((m) => ({ ...(m || {}), [s.shift_id]: e.target.value }))}
                              placeholder="Check-in code"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              aria-label="Check-in code"
                            />
                          </div>
                          <Button
                            variant="secondary"
                            disabled={!online || busyKey === `check-in:${s.shift_id}` || !codeValue.trim()}
                            onClick={async () => {
                              const body = { code: codeValue }
                              if (geoRequired) {
                                try {
                                  const pos = await getBrowserPosition()
                                  body.lat = pos?.coords?.latitude
                                  body.lng = pos?.coords?.longitude
                                } catch (e) {
                                  return toast.error(e?.message ?? 'Failed to get location')
                                }
                              }
                              return post('check-in', s.shift_id, body)
                            }}
                            title={!codeValue.trim() ? 'Enter the code shown by the employer' : undefined}
                          >
                            {busyKey === `check-in:${s.shift_id}` ? 'Working…' : 'Check in'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          disabled={!online || busyKey === `check-in:${s.shift_id}`}
                          onClick={async () => {
                            const body = {}
                            if (geoRequired) {
                              try {
                                const pos = await getBrowserPosition()
                                body.lat = pos?.coords?.latitude
                                body.lng = pos?.coords?.longitude
                              } catch (e) {
                                return toast.error(e?.message ?? 'Failed to get location')
                              }
                            }
                            return post('check-in', s.shift_id, body)
                          }}
                        >
                          {busyKey === `check-in:${s.shift_id}` ? 'Working…' : 'Check in'}
                        </Button>
                      )
                    ) : null}

                    {canCheckOut ? (
                      <Button
                        variant="secondary"
                        disabled={!online || busyKey === `check-out:${s.shift_id}` || status === 'checked_out' || status === 'completed'}
                        onClick={() => post('check-out', s.shift_id)}
                        title={status === 'checked_out' || status === 'completed' ? 'Already checked out' : undefined}
                      >
                        {busyKey === `check-out:${s.shift_id}` ? 'Working…' : status === 'checked_out' || status === 'completed' ? 'Checked out' : 'Check out'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

