export function StarRating({ value, onChange, disabled }) {
  const v = Number(value ?? 0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = v >= n
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={[
              'h-9 w-9 rounded-lg border text-lg',
              active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400',
              disabled ? 'opacity-60' : 'hover:bg-slate-50',
            ].join(' ')}
            aria-label={`${n} star`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}


