import { useCallback, useEffect, useState } from 'react'
import { Card } from '../ui/FormControls.jsx'

const GOAL_STORAGE_KEY = 'artisan:monthly_earnings_goal_ghs'
const CURRENCY_SYMBOL = '₵'

function formatAmount(n) {
  if (n == null || !Number.isFinite(n)) return '0'
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function readGoalFromStorage() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(GOAL_STORAGE_KEY) : null
    if (raw === null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function EarningsGoalWidget({ thisMonthEarnings = 0, currency = 'GHS', loading = false, className = '' }) {
  const [goal, setGoal] = useState(null)

  const refreshGoal = useCallback(() => {
    setGoal(readGoalFromStorage())
  }, [])

  useEffect(() => {
    refreshGoal()
  }, [refreshGoal])

  const setGoalPrompt = () => {
    const raw = window.prompt('Monthly earnings goal (GHS). Leave empty to clear.', goal ? String(goal) : '')
    if (raw === null) return
    if (raw.trim() === '') {
      try {
        window.localStorage.removeItem(GOAL_STORAGE_KEY)
      } catch {}
      setGoal(null)
      return
    }
    const n = Number(raw.trim().replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) return
    try {
      window.localStorage.setItem(GOAL_STORAGE_KEY, String(n))
    } catch {}
    setGoal(n)
  }

  const earned = Number(thisMonthEarnings) || 0
  const goalAmount = goal
  const overGoal = goalAmount != null && goalAmount > 0 && earned >= goalAmount
  const pct = goalAmount != null && goalAmount > 0 ? Math.min(100, Math.round((earned / goalAmount) * 100)) : null

  return (
    <Card className={`border-slate-200 bg-slate-50/50 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Earnings this month</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className={`text-2xl font-bold ${overGoal ? 'text-emerald-700' : 'text-slate-900'}`}>
              {CURRENCY_SYMBOL}{loading ? '—' : formatAmount(earned)}
            </span>
            {goalAmount != null && goalAmount > 0 ? (
              <span className="text-slate-600">of {CURRENCY_SYMBOL}{formatAmount(goalAmount)} goal</span>
            ) : null}
          </div>
          {pct != null && !loading ? (
            <div className="mt-2 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${overGoal ? 'bg-emerald-500' : 'bg-slate-600'}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={setGoalPrompt}
          className="text-left text-xs text-slate-500 hover:text-slate-700"
        >
          {goalAmount != null ? 'Edit goal' : 'Set goal'}
        </button>
      </div>
    </Card>
  )
}
