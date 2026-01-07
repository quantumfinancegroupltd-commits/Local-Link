import { Link } from 'react-router-dom'
import { VerificationBadge } from '../ui/VerificationBadge.jsx'

function displaySkills(p) {
  const skills = p?.skills ?? p?.skillset ?? p?.skillSet ?? null
  if (Array.isArray(skills)) return skills.filter(Boolean).slice(0, 3).join(' • ')
  if (typeof skills === 'string') return skills
  return null
}

export function ProviderCard({ provider }) {
  const name = provider?.name ?? provider?.user?.name ?? provider?.user_name ?? provider?.userName ?? 'Artisan'
  const location =
    provider?.service_area ??
    provider?.serviceArea ??
    provider?.location ??
    provider?.city ??
    provider?.user?.location ??
    '—'
  const skills = displaySkills(provider)
  const rating = provider?.rating ?? provider?.user?.rating ?? null
  const id = provider?.id

  return (
    <Link to={id ? `/buyer/providers/${id}` : '/buyer/providers'} className="group">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition group-hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">{name}</div>
            <div className="mt-1 truncate text-sm text-slate-600">{location}</div>
          </div>
          <VerificationBadge entity={provider?.user ?? provider} />
        </div>

        {skills && <div className="mt-3 text-sm text-slate-700">{skills}</div>}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">Rating</div>
          <div className="text-sm font-semibold text-slate-900">{rating ?? '—'}</div>
        </div>
      </div>
    </Link>
  )
}


