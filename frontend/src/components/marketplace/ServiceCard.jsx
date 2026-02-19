import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { Button } from '../ui/FormControls.jsx'
import { VerificationBadge } from '../ui/VerificationBadge.jsx'
import { ui } from '../ui/tokens.js'

function formatDuration(min) {
  if (min == null || min <= 0) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function ServiceCard({ service }) {
  const { isAuthed, user } = useAuth()
  const artisanId = service?.artisan_user_id ?? service?.artisanUserId
  const title = service?.title ?? ''
  const description = service?.description ?? ''
  const price = service?.price ?? 0
  const currency = service?.currency ?? 'GHS'
  const duration = formatDuration(service?.duration_minutes ?? service?.durationMinutes)
  const category = service?.category ?? 'Service'
  const imageUrl = service?.image_url ?? service?.imageUrl ?? null
  const artisanName = service?.artisan_name ?? service?.artisanName ?? 'Provider'
  const serviceArea = service?.service_area ?? service?.serviceArea ?? null
  const verifyEntity = { verification_tier: service?.verification_tier ?? service?.verificationTier ?? 'unverified' }

  const bookPath = `/buyer/jobs/new?artisan=${encodeURIComponent(artisanId)}&service=${encodeURIComponent(service?.id)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}&budget=${encodeURIComponent(price)}&category=${encodeURIComponent(category)}`
  const bookTo =
    isAuthed && user?.role === 'buyer'
      ? bookPath
      : `/login?next=${encodeURIComponent(bookPath)}`

  return (
    <div className={['overflow-hidden', ui.card].join(' ')}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-violet-400 via-indigo-300 to-sky-400" />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
            {category}
          </span>
          <VerificationBadge entity={verifyEntity} />
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="font-semibold text-slate-900 truncate">{title}</div>
          <div className="mt-0.5 text-xs text-slate-600 truncate">
            {artisanName}
            {serviceArea ? ` · ${serviceArea}` : ''}
          </div>
        </div>
        {description ? (
          <p className="text-xs text-slate-600 line-clamp-2">{description}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">
            {currency} {Number(price).toFixed(0)}
            {duration ? ` · ${duration}` : ''}
          </div>
          <div className="flex gap-2">
            <Link to={bookTo}>
              <Button size="sm">Book</Button>
            </Link>
            <Link to={`/u/${artisanId}`}>
              <Button variant="secondary" size="sm">
                Profile
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
