import { Link } from 'react-router-dom'

export function UseCaseTile({ title, description, to, accent = 'emerald', imageUrl }) {
  const accentClass =
    accent === 'orange'
      ? 'from-orange-500/15 via-lime-400/10 to-emerald-500/10'
      : accent === 'lime'
        ? 'from-lime-500/15 via-emerald-500/10 to-orange-400/10'
        : accent === 'slate'
          ? 'from-slate-200/60 via-slate-100/40 to-white'
          : 'from-emerald-500/15 via-lime-400/10 to-orange-400/10'

  return (
    <Link to={to} className="group">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition group-hover:shadow-md">
        <div className="relative aspect-[4/3] w-full bg-slate-100">
          <div className={`absolute inset-0 bg-gradient-to-br ${accentClass}`} />
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
            Explore
          </div>
        </div>

        <div className="p-5">
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{description}</div>
          <div className="mt-4 text-sm font-semibold text-emerald-700 group-hover:underline">
            Explore →
          </div>
        </div>
      </div>
    </Link>
  )
}


