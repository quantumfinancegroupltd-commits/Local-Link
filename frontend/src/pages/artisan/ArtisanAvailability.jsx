import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

function formatRange(month, year) {
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function daysInMonth(month, year) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days = []
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

export function ArtisanAvailability() {
  const toast = useToast()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [availableDates, setAvailableDates] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const { from, to } = formatRange(month, year)
  const days = daysInMonth(month, year)

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

  function prevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        kicker="Profile"
        title="My availability"
        subtitle="Mark dates when you're available for bookings. Buyers see these on your profile."
        actions={
          <Link to="/artisan">
            <Button variant="secondary">Back</Button>
          </Link>
        }
      />

      <Card>
        <div className="flex items-center justify-between gap-4">
          <Button variant="secondary" size="sm" onClick={prevMonth}>
            ← Previous
          </Button>
          <div className="text-lg font-semibold">{monthName}</div>
          <Button variant="secondary" size="sm" onClick={nextMonth}>
            Next →
          </Button>
        </div>
        <div className="mt-4 text-sm text-slate-600">
          Click a date to add or remove it from your availability.
        </div>
        {loading ? (
          <div className="mt-6 text-sm text-slate-600">Loading…</div>
        ) : (
          <div className="mt-4 grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-slate-500">
                {d}
              </div>
            ))}
            {days[0]?.getDay() ? Array.from({ length: days[0].getDay() }, (_, i) => <div key={`pad-${i}`} />) : null}
            {days.map((d) => {
              const y = d.getFullYear()
              const m = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')
              const dateStr = `${y}-${m}-${day}`
              const isAvailable = availableDates.has(dateStr)
              const isPast = d < new Date(now.getFullYear(), now.getMonth(), now.getDate())
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isPast || busy}
                  onClick={() => !isPast && toggleDate(dateStr)}
                  className={`
                    rounded-lg py-2 text-sm font-medium transition
                    ${isPast ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'hover:bg-slate-100'}
                    ${isAvailable ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500' : 'bg-white text-slate-700'}
                  `}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
