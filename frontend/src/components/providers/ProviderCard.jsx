import { Link } from 'react-router-dom'
import { VerificationBadge } from '../ui/VerificationBadge.jsx'
import { TrustBadge } from '../ui/TrustBadge.jsx'
import { ui } from '../ui/tokens.js'

function displaySkills(p) {
  const skills = p?.skills ?? p?.skillset ?? p?.skillSet ?? null
  if (Array.isArray(skills)) return skills.filter(Boolean).slice(0, 3).join(' • ')
  if (typeof skills === 'string') return skills
  return null
}

function titleCaseWords(s) {
  const raw = String(s || '').trim()
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

export function ProviderCard({ provider, meta }) {
  const name = provider?.name ?? provider?.user?.name ?? provider?.user_name ?? provider?.userName ?? 'Artisan'
  const professionRaw = provider?.primary_skill ?? provider?.primarySkill ?? provider?.user?.primary_skill ?? null
  const profession = professionRaw ? titleCaseWords(professionRaw) : null
  const location =
    provider?.service_area ??
    provider?.serviceArea ??
    provider?.location ??
    provider?.city ??
    provider?.user?.location ??
    '—'
  const skills = displaySkills(provider)
  const rating = provider?.rating ?? provider?.user?.rating ?? null
  const userId = provider?.user_id ?? provider?.user?.id ?? null
  const trustScore = provider?.user?.trust_score ?? provider?.trust_score ?? null
  const profilePic = provider?.user?.profile_pic ?? provider?.profile_pic ?? null
  const verifiedReviews = provider?.user?.verified_reviews_count ?? provider?.verified_reviews_count ?? null

  return (
    <Link to={userId ? `/u/${userId}` : '/buyer/providers'} className="group">
      <div className={['overflow-hidden', ui.card, ui.cardHover].join(' ')}>
        {/* Media header (matches marketplace cards) */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {profilePic ? (
            <img
              src={profilePic}
              alt={name ? `${name} profile` : 'Provider'}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-900 via-emerald-600 to-orange-400 opacity-90" />
          )}
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
              {profession || 'Provider'}
            </div>
            <TrustBadge trustScore={trustScore} />
            <VerificationBadge entity={provider?.user ?? provider} />
            {typeof verifiedReviews === 'number' && verifiedReviews > 0 ? (
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                {verifiedReviews} verified reviews
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
              <div className="mt-1 truncate text-xs text-slate-600">{[profession, location].filter(Boolean).join(' • ') || location}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Rating</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{rating ?? '—'}</div>
            </div>
          </div>

          {skills ? <div className="mt-3 text-xs font-semibold text-slate-700">{skills}</div> : null}
          {meta?.why ? <div className="mt-3 text-xs font-medium text-slate-600">{meta.why}</div> : null}
        </div>
      </div>
    </Link>
  )
}


