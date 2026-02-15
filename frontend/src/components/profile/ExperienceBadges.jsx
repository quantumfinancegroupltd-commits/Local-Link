import { useMemo } from 'react'

function toneClasses(tone) {
  const t = String(tone || 'slate')
  if (t === 'emerald') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  if (t === 'blue') return 'border-blue-200 bg-blue-50 text-blue-900'
  return 'border-slate-200 bg-white text-slate-800'
}

export function ExperienceBadgesRow({ badges, max = 6, className = '', onBadgeClick }) {
  const items = useMemo(() => (Array.isArray(badges) ? badges.filter((b) => b?.title) : []), [badges])
  if (!items.length) return null
  const clickable = typeof onBadgeClick === 'function'

  return (
    <div className={['flex flex-wrap gap-2', className].join(' ')}>
      {items.slice(0, max).map((b) => (
        <button
          key={b.key || b.title}
          type="button"
          onClick={clickable ? () => onBadgeClick(b) : undefined}
          disabled={!clickable}
          title={b?.why ? String(b.why) : String(b.title)}
          className={[
            'rounded-full border px-3 py-1 text-xs font-semibold',
            toneClasses(b.tone),
            clickable ? 'cursor-pointer hover:opacity-90' : 'cursor-default',
          ].join(' ')}
          aria-label={b?.why ? `${String(b.title)}. ${String(b.why)}` : String(b.title)}
        >
          {b.title}
        </button>
      ))}
    </div>
  )
}

