import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { imageProxySrc } from '../../lib/imageProxy.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { VerificationBadge } from '../../components/ui/VerificationBadge.jsx'
import { BrowseMap } from '../../components/maps/BrowseMap.jsx'
import { ui } from '../../components/ui/tokens.js'
import { useAuth } from '../../auth/useAuth.js'
import { EmptyState } from '../../components/ui/EmptyState.jsx'

function formatDuration(min) {
  if (min == null || min <= 0) return null
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function MarketplaceServiceDetail() {
  const { id } = useParams()
  const { isAuthed, user } = useAuth()
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get(`/marketplace/services/${encodeURIComponent(id)}`)
        if (!cancelled) setService(res.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Service not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const hasCoords = useMemo(() => {
    const lat = service?.service_lat ?? service?.serviceLat ?? null
    const lng = service?.service_lng ?? service?.serviceLng ?? null
    return lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  }, [service])

  const mapCenter = useMemo(() => {
    if (!hasCoords) return null
    return {
      lat: Number(service?.service_lat ?? service?.serviceLat),
      lng: Number(service?.service_lng ?? service?.serviceLng),
    }
  }, [hasCoords, service])

  const artisanId = service?.artisan_user_id ?? service?.artisanUserId
  const title = service?.title ?? 'Service'
  const description = service?.description ?? ''
  const price = service?.price ?? 0
  const currency = service?.currency ?? 'GHS'
  const duration = formatDuration(service?.duration_minutes ?? service?.durationMinutes)
  const category = service?.category ?? null
  const imageUrl = service?.image_url ?? service?.imageUrl ?? null
  const artisanName = service?.artisan_name ?? service?.artisanName ?? 'Provider'
  const serviceArea = service?.service_area ?? service?.serviceArea ?? null
  const verifyEntity = { verification_tier: service?.verification_tier ?? service?.verificationTier ?? 'unverified' }

  const bookPath = `/buyer/jobs/new?artisan=${encodeURIComponent(artisanId)}&service=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description || '')}&budget=${encodeURIComponent(price)}&category=${encodeURIComponent(category || '')}`
  const bookTo =
    isAuthed && user?.role === 'buyer'
      ? bookPath
      : `/login?next=${encodeURIComponent(bookPath)}`

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-8">Loading…</Card>
      </div>
    )
  }

  if (error || !service) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Service not found"
          description={error || 'This service may no longer be available.'}
          actions={
            <Link to="/marketplace?tab=services">
              <Button variant="secondary">Back to Services</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/marketplace?tab=services" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
          ← Services
        </Link>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-slate-800/50">
          {imageUrl ? (
            <img
              src={imageProxySrc(imageUrl) || imageUrl}
              alt={title}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet-400 via-indigo-300 to-sky-400" />
          )}
          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
            {category ? (
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur dark:bg-white/20 dark:text-slate-100">
                {category}
              </span>
            ) : null}
            <VerificationBadge entity={verifyEntity} size="md" />
          </div>
        </div>
        <div className="p-6">
          <h1 className={ui.h1}>{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            {artisanName ? <span>{artisanName}</span> : null}
            {serviceArea ? <span>{serviceArea}</span> : null}
            {duration ? <span>{duration}</span> : null}
          </div>
          <div className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            {currency} {Number(price).toFixed(0)}
            {duration ? ` · ${duration}` : ''}
          </div>
          {description ? (
            <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{description}</div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={bookTo}>
              <Button>Book this service</Button>
            </Link>
            <Link to={artisanId ? `/u/${artisanId}` : '#'}>
              <Button variant="secondary">View provider profile</Button>
            </Link>
          </div>
        </div>
      </div>

      {hasCoords && mapCenter ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Map</h2>
          <div className="mt-3 h-56 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
            <BrowseMap
              pins={[
                {
                  id: 'service',
                  lat: mapCenter.lat,
                  lng: mapCenter.lng,
                  title,
                  subtitle: [artisanName, serviceArea].filter(Boolean).join(' · ') || undefined,
                },
              ]}
              defaultCenter={mapCenter}
              defaultZoom={12}
              className="h-full w-full"
            />
          </div>
        </Card>
      ) : null}
    </div>
  )
}
