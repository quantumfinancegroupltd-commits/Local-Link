import { useState } from 'react'

/**
 * Lightweight SVG line chart for time-series. No external deps.
 * series: Array<{ day: string, [valueKey]: number }>
 * valueKey: key in each point for the value (e.g. 'clicks', 'signups', 'commission')
 * title: optional chart title
 * valueLabel: optional label for axis (e.g. 'Clicks', 'Signups')
 * color: stroke/fill color (default emerald)
 * formatValue: (n) => string for tooltip/legend
 */
export function SimpleLineChart({
  series = [],
  valueKey = 'value',
  title,
  valueLabel,
  color = '#0d9488',
  height = 200,
  formatValue = (n) => String(n),
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const rows = Array.isArray(series) ? series : []

  function formatDay(day) {
    if (!day) return ''
    const d = new Date(day)
    if (Number.isNaN(d.getTime())) return String(day).slice(0, 5)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-black/95 dark:text-slate-200">
        {title ? <div className="text-sm font-semibold text-slate-700 dark:text-white">{title}</div> : null}
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">No data for this period.</div>
      </div>
    )
  }

  const values = rows.map((r) => Number(r[valueKey] ?? 0))
  const max = Math.max(1, ...values)
  const w = 640
  const h = height
  const pad = { left: 40, right: 20, top: 20, bottom: 32 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const dx = rows.length > 1 ? chartW / (rows.length - 1) : 0
  const pts = values.map((v, i) => {
    const x = pad.left + i * dx
    const y = pad.top + chartH - (v / max) * chartH
    return [x, Number.isFinite(y) ? y : pad.top + chartH]
  })
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const areaD =
    lineD +
    ` L${pts[pts.length - 1]?.[0] ?? 0},${pad.top + chartH} L${pts[0]?.[0] ?? 0},${pad.top + chartH} Z`

  function handleMouseMove(evt) {
    const svg = evt.currentTarget
    const rect = svg.getBoundingClientRect()
    const viewX = (evt.clientX - rect.left) / rect.width * w
    const index = dx > 0 ? Math.round((viewX - pad.left) / dx) : 0
    const clamped = Math.max(0, Math.min(rows.length - 1, Number.isFinite(index) ? index : 0))
    setHoveredIndex(clamped)
  }

  const step = Math.max(1, Math.floor(rows.length / 8))
  const hovered = hoveredIndex != null ? rows[hoveredIndex] : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-black/95">
      {title ? (
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800 dark:text-white">{title}</span>
          {valueLabel ? <span className="text-xs text-slate-500 dark:text-slate-400">{valueLabel}</span> : null}
        </div>
      ) : null}
      {hovered ? (
        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          {formatDay(hovered.day)} — {formatValue(hovered[valueKey])}
        </div>
      ) : null}
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="max-w-full overflow-visible cursor-crosshair"
        role="img"
        aria-label={title || 'Chart'}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {[1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={pad.left}
            y1={pad.top + (chartH * i) / 4}
            x2={pad.left + chartW}
            y2={pad.top + (chartH * i) / 4}
            className="stroke-slate-200 dark:stroke-slate-600"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        ))}
        <path d={areaD} fill={color} fillOpacity="0.12" />
        <path
          d={lineD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {rows.map((r, i) => {
          if (i % step !== 0 && i !== rows.length - 1) return null
          const x = pad.left + i * dx
          return (
            <text
              key={i}
              x={x}
              y={pad.top + chartH + 18}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-medium dark:fill-slate-400"
            >
              {formatDay(r.day)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
