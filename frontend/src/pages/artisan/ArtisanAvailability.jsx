import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { AvailabilityCalendar } from '../../components/calendar/AvailabilityCalendar.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

function formatRange(month, year) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  const ys = start.getFullYear()
  const ms = String(start.getMonth() + 1).padStart(2, '0')
  const ds = String(start.getDate()).padStart(2, '0')
  const ye = end.getFullYear()
  const me = String(end.getMonth() + 1).padStart(2, '0')
  const de = String(end.getDate()).padStart(2, '0')
  return {
    from: `${ys}-${ms}-${ds}`,
    to: `${ye}-${me}-${de}`,
  }
}

export function ArtisanAvailability() {
  const toast = useToast()
  const init = new Date()
  const [month, setMonth] = useState(init.getMonth())
  const [year, setYear] = useState(init.getFullYear())
  const [availableDates, setAvailableDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const { from, to } = formatRange(month, year)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await http.get('/artisans/me/availability', { params: { from, to } })
        const dates = Array.isArray(r.data) ? r.data : []
        if (!cancelled) setAvailableDates(new Set(dates))
      } catch {
        if (!cancelled) setAvailableDates(new Set())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [from, to])

  async function toggleDate(dateStr) {
    if (busy) return
    const isAvailable = availableDates.has(dateStr)
    setBusy(true)
    try {
      if (isAvailable) {
        await http.delete(`/artisans/me/availability/${dateStr}`)
        setAvailableDates((prev) => {
          const next = new Set(prev)
          next.delete(dateStr)
          return next
        })
        toast.success('Date removed')
      } else {
        await http.post('/artisans/me/availability', { dates: [dateStr] })
        setAvailableDates((prev) => new Set([...prev, dateStr]))
        toast.success('Date added')
      }
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        kicker="Profile"
        title="My availability"
        subtitle="Mark dates when you're available for bookings. Use arrows and Today to navigate."
        actions={
          <Link to="/artisan">
            <Button variant="secondary">Back</Button>
          </Link>
        }
      />

      <Card>
        <div className="text-sm font-semibold">Availability calendar</div>
        <div className="mt-1 text-xs text-slate-600">
          Click a date to add or remove it. Past dates cannot be changed.
        </div>
        <div className="mt-4">
          <AvailabilityCalendar
            availableDates={availableDates}
            month={month}
            year={year}
            onMonthChange={(m, y) => {
              setMonth(m)
              setYear(y)
            }}
            onDateClick={toggleDate}
            disabledPast
            loading={loading}
            busy={busy}
          />
        </div>
      </Card>
    </div>
  )
}
