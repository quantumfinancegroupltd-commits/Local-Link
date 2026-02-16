import { Button } from '../ui/FormControls.jsx'

function daysInMonth(month, year) {
  const last = new Date(year, month + 1, 0)
  const days = []
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

function dateToYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * AvailabilityCalendar - interactive month grid with navigation.
 * @param {object} props
 * @param {Set<string>|string[]} props.availableDates - YYYY-MM-DD strings
 * @param {number} props.month - 0-11
 * @param {number} props.year
 * @param {function} props.onMonthChange - (month, year) => void
 * @param {function} [props.onDateClick] - (dateStr) => void; if provided, dates are clickable
 * @param {boolean} [props.disabledPast] - disable past dates (for artisan mode)
 * @param {boolean} [props.loading]
 * @param {boolean} [props.busy] - disable interactions
 * @param {boolean} [props.compact] - smaller padding
 * @param {boolean} [props.showMonthYearPicker] - show month/year dropdowns for quick jump
 */
export function AvailabilityCalendar({
  availableDates = new Set(),
  month,
  year,
  onMonthChange,
  onDateClick,
  disabledPast = false,
  loading = false,
  busy = false,
  compact = false,
  showMonthYearPicker = true,
}) {
  const now = new Date()
  const todayYmd = dateToYmd(now)
  const days = daysInMonth(month, year)
  const availSet = availableDates instanceof Set ? availableDates : new Set(availableDates || [])
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })

  const goPrev = () => {
    if (month === 0) onMonthChange(11, year - 1)
    else onMonthChange(month - 1, year)
  }

  const goNext = () => {
    if (month === 11) onMonthChange(0, year + 1)
    else onMonthChange(month + 1, year)
  }

  const goToday = () => {
    onMonthChange(now.getMonth(), now.getFullYear())
  }

  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear()

  const startYear = now.getFullYear()
  const years = Array.from({ length: 4 }, (_, i) => startYear + i)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={goPrev} disabled={busy} title="Previous month">
            ←
          </Button>
          {showMonthYearPicker ? (
            <div className="flex items-center gap-1">
              <select
                value={month}
                onChange={(e) => onMonthChange(Number(e.target.value), year)}
                disabled={busy}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label="Month"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => onMonthChange(month, Number(e.target.value))}
                disabled={busy}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label="Year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="min-w-[140px] text-center text-base font-semibold text-slate-900">{monthName}</div>
          )}
          <Button variant="secondary" size="sm" onClick={goNext} disabled={busy} title="Next month">
            →
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={goToday} disabled={busy || isCurrentMonth} title="Jump to current month">
          Today
        </Button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1 text-center text-xs font-medium text-slate-500">
              {d}
            </div>
          ))}
          {days[0]?.getDay() ? Array.from({ length: days[0].getDay() }, (_, i) => <div key={`pad-${i}`} />) : null}
          {days.map((d) => {
            const dateStr = dateToYmd(d)
            const isAvailable = availSet.has(dateStr)
            const isPast = disabledPast && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const isToday = dateStr === todayYmd
            const clickable = !!onDateClick && !isPast && !busy

            const baseClass = compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
            let btnClass = `rounded-lg font-medium transition ${baseClass}`
            if (isPast) {
              btnClass += ' cursor-not-allowed bg-slate-50 text-slate-400'
            } else if (clickable) {
              btnClass += ' hover:bg-slate-100 cursor-pointer'
            } else {
              btnClass += ' cursor-default'
            }
            if (isAvailable) btnClass += ' bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500'
            else btnClass += ' bg-white text-slate-700'
            if (isToday && !isAvailable) btnClass += ' ring-2 ring-slate-300'

            const content = (
              <>
                {d.getDate()}
                {isToday ? <span className="sr-only"> (today)</span> : null}
              </>
            )

            if (onDateClick && !isPast) {
              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={busy}
                  onClick={() => onDateClick(dateStr)}
                  className={btnClass}
                >
                  {content}
                </button>
              )
            }
            return (
              <div key={dateStr} className={btnClass} aria-disabled={isPast}>
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
