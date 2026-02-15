function bandFromPct(pct) {
  const p = Number(pct)
  if (!Number.isFinite(p)) return 'low'
  if (p >= 80) return 'high'
  if (p >= 55) return 'medium'
  return 'low'
}

function normalizeToPct(trustScore) {
  const n = Number(trustScore)
  if (!Number.isFinite(n)) return null
  // accept 0..1 or 0..100
  const pct = n <= 1 ? n * 100 : n
  return Math.max(0, Math.min(100, Math.round(pct)))
}

export function TrustBadge({ trustScore, size = 'sm', showBand = true }) {
  const pct = normalizeToPct(trustScore)
  if (pct == null) {
    return (
      <span className="rounded-full border bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur" title="Trust: not enough history yet">
        Trust: —
      </span>
    )
  }

  const band = bandFromPct(pct)
  const base =
    size === 'md'
      ? 'px-3 py-1 text-xs'
      : size === 'lg'
        ? 'px-3.5 py-1.5 text-sm'
        : 'px-2.5 py-1 text-xs'

  const tone =
    band === 'high'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : band === 'medium'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-slate-200 bg-slate-50 text-slate-700'

  const label = showBand ? `${band.toUpperCase()} • ${pct}/100` : `${pct}/100`

  return (
    <span className={`rounded-full border ${base} font-semibold ${tone}`} title={`Trust score: ${pct}/100`}>
      Trust {label}
    </span>
  )
}


