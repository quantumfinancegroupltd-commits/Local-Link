import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Card } from '../ui/FormControls.jsx'

const BUDGET_STORAGE_KEY = 'buyer:monthly_budget_ghs'
const CURRENCY_SYMBOL = '₵'

function formatAmount(n) {
  if (n == null || !Number.isFinite(n)) return '0'
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function readBudgetFromStorage() {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(BUDGET_STORAGE_KEY) : null
    if (raw === null || raw === '') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function SpendSummaryWidget({ className = '', compact = false }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monthlyBudget, setMonthlyBudget] = useState(null)

  const loadSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await http.get('/buyer/job-history/summary')
      setSummary(res.data ?? null)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    setMonthlyBudget(readBudgetFromStorage())
  }, [])

  const setBudget = () => {
    const raw = window.prompt('Monthly budget (GHS). Leave empty to clear.', monthlyBudget ? String(monthlyBudget) : '')
    if (raw === null) return
    if (raw.trim() === '') {
      try {
        window.localStorage.removeItem(BUDGET_STORAGE_KEY)
      } catch {}
      setMonthlyBudget(null)
      return
    }
    const n = Number(raw.trim().replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) return
    try {
      window.localStorage.setItem(BUDGET_STORAGE_KEY, String(n))
    } catch {}
    setMonthlyBudget(n)
  }

  if (loading && !summary) {
    return (
      <Card className={`border-slate-200 ${className}`}>
        <div className="text-sm text-slate-500">Loading spend…</div>
      </Card>
    )
  }

  const thisMonth = summary?.this_month ?? 0
  const totalSpend = summary?.total_spend ?? 0
  const budget = monthlyBudget
  const overBudget = budget != null && budget > 0 && thisMonth > budget
  const pct = budget != null && budget > 0 ? Math.min(100, Math.round((thisMonth / budget) * 100)) : null

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
        <span className="font-semibold text-slate-900">
          {CURRENCY_SYMBOL}{formatAmount(thisMonth)} this month
          {budget != null && budget > 0 ? (
            <span className="ml-1 font-normal text-slate-600">
              / {CURRENCY_SYMBOL}{formatAmount(budget)}
              {overBudget ? <span className="ml-1 text-amber-600">(over)</span> : null}
            </span>
          ) : null}
        </span>
        <Link to="/buyer/history" className="text-emerald-700 hover:underline">History</Link>
        <button type="button" onClick={setBudget} className="text-slate-500 hover:text-slate-700">
          {budget != null ? 'Edit budget' : 'Set budget'}
        </button>
      </div>
    )
  }

  return (
    <Card className={`border-slate-200 bg-slate-50/50 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Spend this month</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className={`text-2xl font-bold ${overBudget ? 'text-amber-700' : 'text-slate-900'}`}>
              {CURRENCY_SYMBOL}{formatAmount(thisMonth)}
            </span>
            {budget != null && budget > 0 ? (
              <span className="text-slate-600">of {CURRENCY_SYMBOL}{formatAmount(budget)}</span>
            ) : null}
          </div>
          {pct != null ? (
            <div className="mt-2 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${overBudget ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          ) : null}
          <div className="mt-2 text-xs text-slate-500">Total all time: {CURRENCY_SYMBOL}{formatAmount(totalSpend)}</div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Link to="/buyer/history" className="text-sm font-medium text-emerald-700 hover:underline">
            View history
          </Link>
          <button type="button" onClick={setBudget} className="text-left text-xs text-slate-500 hover:text-slate-700">
            {budget != null ? 'Edit monthly budget' : 'Set monthly budget'}
          </button>
        </div>
      </div>
    </Card>
  )
}
