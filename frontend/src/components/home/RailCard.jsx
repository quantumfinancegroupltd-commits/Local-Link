import { Link } from 'react-router-dom'
import { VerificationBadge } from '../ui/VerificationBadge.jsx'

export function RailCard({ to, imageUrl, title, subtitle, meta, badgeEntity }) {
  return (
    <Link to={to} className="group" style={{ scrollSnapAlign: 'start' }}>
      <div className="w-[260px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition group-hover:shadow-md sm:w-[300px]">
        <div className="relative aspect-[4/3] w-full bg-slate-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-brand-emerald/30 via-brand-lime/20 to-brand-orange/25" />
          )}
          {badgeEntity ? (
            <div className="absolute left-3 top-3">
              <VerificationBadge entity={badgeEntity} />
            </div>
          ) : null}
        </div>
        <div className="p-4">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-600">{subtitle}</div> : null}
          {meta ? <div className="mt-3 text-sm font-semibold text-slate-900">{meta}</div> : null}
        </div>
      </div>
    </Link>
  )
}


