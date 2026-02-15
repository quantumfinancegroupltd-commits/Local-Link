export function Tabs({ value, onChange, tabs }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1">
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-semibold transition',
              active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}


