import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { http } from '../../api/http.js'
import { ProviderCard } from '../../components/providers/ProviderCard.jsx'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { haversineKm, formatKm } from '../../lib/geo.js'
import { getVerificationTier, tierRank } from '../../lib/verification.js'
import { ui } from '../../components/ui/tokens.js'
import { useToast } from '../../components/ui/Toast.jsx'

export function BuyerProviders() {
  const { user } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [providers, setProviders] = useState([])
  const [searchProviders, setSearchProviders] = useState(null) // when q is set, results from GET /search
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('all') // 'all' | 'saved'
  const [savedIds, setSavedIds] = useState(new Set())
  const [savedProviders, setSavedProviders] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)

  const [q, setQ] = useState('')
  const [location, setLocation] = useState('all') // legacy text-based filter
  const [tier, setTier] = useState('all')
  const [minRating, setMinRating] = useState('all')
  const [sort, setSort] = useState('best')

  const [near, setNear] = useState('')
  const [nearLat, setNearLat] = useState(null)
  const [nearLng, setNearLng] = useState(null)
  const [radiusKm, setRadiusKm] = useState('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/artisans')
        const list = Array.isArray(res.data) ? res.data : res.data?.artisans ?? res.data?.data ?? []
        if (!cancelled) setProviders(list)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load artisans')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Load saved provider IDs (and full list when on Saved tab) for buyers
  const isBuyer = user?.role === 'buyer'
  useEffect(() => {
    if (!isBuyer) return
    let cancelled = false
    async function loadSaved() {
      try {
        const res = await http.get('/buyer/saved-providers')
        const ids = res.data?.saved_artisan_ids ?? []
        if (!cancelled) setSavedIds(new Set(ids))
      } catch {
        if (!cancelled) setSavedIds(new Set())
      }
    }
    loadSaved()
    return () => { cancelled = true }
  }, [isBuyer])

  useEffect(() => {
    if (!isBuyer || viewMode !== 'saved') return
    let cancelled = false
    setSavedLoading(true)
    http.get('/buyer/saved-providers', { params: { full: 1 } })
      .then((res) => {
        const items = res.data?.items ?? []
        if (!cancelled) setSavedProviders(items)
      })
      .catch(() => { if (!cancelled) setSavedProviders([]) })
      .finally(() => { if (!cancelled) setSavedLoading(false) })
    return () => { cancelled = true }
  }, [isBuyer, viewMode])

  const handleSave = useCallback(async (artisanUserId) => {
    try {
      await http.post('/buyer/saved-providers', { artisan_user_id: artisanUserId })
      setSavedIds((prev) => new Set([...prev, artisanUserId]))
      toast.success('Added to my trusted providers.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Could not save provider.')
    }
  }, [toast])

  const handleUnsave = useCallback(async (artisanUserId) => {
    try {
      await http.delete(`/buyer/saved-providers/${artisanUserId}`)
      setSavedIds((prev) => {
        const next = new Set(prev)
        next.delete(artisanUserId)
        return next
      })
      if (viewMode === 'saved') setSavedProviders((prev) => prev.filter((p) => p.artisan_user_id !== artisanUserId))
      toast.success('Removed from saved.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? 'Could not remove.')
    }
  }, [toast, viewMode])

  // Server-side full-text search when user types in search box
  useEffect(() => {
    const term = String(q ?? '').trim()
    if (!term) {
      setSearchProviders(null)
      return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await http.get('/search', { params: { q: term, type: 'providers', limit: 100 } })
        const rows = Array.isArray(res.data?.providers) ? res.data.providers : []
        const normalized = rows.map((row) => ({
          id: row.artisan_id,
          user_id: row.user_id,
          name: row.name,
          primary_skill: row.primary_skill,
          service_area: row.service_area,
          skills: row.skills,
          rating: row.rating,
          profile_pic: row.profile_pic,
          trust_score: row.trust_score,
          premium: row.premium,
          user: {
            id: row.user_id,
            name: row.name,
            rating: row.rating,
            profile_pic: row.profile_pic,
            trust_score: row.trust_score,
            verification_tier: row.verification_tier,
          },
        }))
        setSearchProviders(normalized)
      } catch {
        setSearchProviders([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    const nextQ = String(searchParams.get('q') || '')
    const nextLoc = String(searchParams.get('loc') || 'all')
    const nextTier = String(searchParams.get('tier') || 'all')
    const nextMin = String(searchParams.get('min') || 'all')
    const nextSort = String(searchParams.get('sort') || 'best')
    const nextNear = String(searchParams.get('near') || '')
    const nextRad = String(searchParams.get('rad') || 'all')
    const nextLatRaw = searchParams.get('near_lat')
    const nextLngRaw = searchParams.get('near_lng')
    const nextLat = nextLatRaw == null || nextLatRaw === '' ? null : Number(nextLatRaw)
    const nextLng = nextLngRaw == null || nextLngRaw === '' ? null : Number(nextLngRaw)

    if (nextQ !== q) setQ(nextQ)
    if (nextLoc !== location) setLocation(nextLoc)
    if (nextTier !== tier) setTier(nextTier)
    if (nextMin !== minRating) setMinRating(nextMin)
    if (nextSort !== sort) setSort(nextSort)
    if (nextNear !== near) setNear(nextNear)
    if (nextRad !== radiusKm) setRadiusKm(nextRad)
    if ((Number.isFinite(nextLat) ? nextLat : null) !== nearLat) setNearLat(Number.isFinite(nextLat) ? nextLat : null)
    if ((Number.isFinite(nextLng) ? nextLng : null) !== nearLng) setNearLng(Number.isFinite(nextLng) ? nextLng : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const q0 = String(q || '').trim()
      const loc0 = String(location || '').trim()
      const tier0 = String(tier || '').trim()
      const min0 = String(minRating || '').trim()
      const sort0 = String(sort || '').trim()
      const near0 = String(near || '').trim()
      const rad0 = String(radiusKm || '').trim()

      if (q0) next.set('q', q0)
      else next.delete('q')
      if (loc0 && loc0 !== 'all') next.set('loc', loc0)
      else next.delete('loc')
      if (tier0 && tier0 !== 'all') next.set('tier', tier0)
      else next.delete('tier')
      if (min0 && min0 !== 'all') next.set('min', min0)
      else next.delete('min')
      if (sort0 && sort0 !== 'best') next.set('sort', sort0)
      else next.delete('sort')
      if (near0) next.set('near', near0)
      else next.delete('near')
      if (nearLat != null && Number.isFinite(Number(nearLat))) next.set('near_lat', String(nearLat))
      else next.delete('near_lat')
      if (nearLng != null && Number.isFinite(Number(nearLng))) next.set('near_lng', String(nearLng))
      else next.delete('near_lng')
      if (rad0 && rad0 !== 'all') next.set('rad', rad0)
      else next.delete('rad')

      if (String(next.toString()) !== String(searchParams.toString())) setSearchParams(next, { replace: true })
    }, 250)
    return () => clearTimeout(t)
  }, [q, location, tier, minRating, sort, near, nearLat, nearLng, radiusKm, searchParams, setSearchParams])

  async function copyCurrentLink() {
    const href = window.location?.href ? String(window.location.href) : ''
    if (!href) return toast.error('Copy failed', 'Missing URL')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(href)
        toast.success('Link copied.')
        return
      }
      window.prompt('Copy this link', href)
    } catch (e) {
      toast.error('Copy failed', e?.message ?? 'Unable to copy link')
    }
  }

  const baseProviders = viewMode === 'saved'
    ? savedProviders
    : (searchProviders !== null ? searchProviders : providers)

  const locations = useMemo(() => {
    const set = new Set()
    for (const p of baseProviders) {
      const loc =
        p?.service_area ??
        p?.serviceArea ??
        p?.location ??
        p?.city ??
        p?.user?.location ??
        null
      if (typeof loc === 'string' && loc.trim()) set.add(loc.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [baseProviders])

  const skillOptions = useMemo(() => {
    const set = new Set()
    for (const p of baseProviders) {
      const skills = p?.skills
      if (Array.isArray(skills)) {
        for (const s of skills) {
          const v = String(s || '').trim()
          if (v) set.add(v)
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 60)
  }, [baseProviders])

  const skillFromQuery = useMemo(() => {
    const t = String(q || '').trim().toLowerCase()
    if (!t) return null
    const best = skillOptions.find((s) => s.toLowerCase().includes(t) || t.includes(s.toLowerCase()))
    return best ?? null
  }, [q, skillOptions])

  const filtered = useMemo(() => {
    const origin = nearLat != null && nearLng != null ? { lat: Number(nearLat), lng: Number(nearLng) } : null
    const radius = radiusKm === 'all' ? null : Number(radiusKm)
    const minR = minRating === 'all' ? null : Number(minRating)

    const scored = baseProviders
      .map((p) => {
        const name = p?.name ?? p?.user?.name ?? ''
        const skills = Array.isArray(p?.skills) ? p.skills.join(' ') : p?.skills ?? ''
        const loc =
          p?.service_area ??
          p?.serviceArea ??
          p?.location ??
          p?.city ??
          p?.user?.location ??
          ''

        const hay = `${name} ${skills} ${loc}`.toLowerCase()
        const matchQ = hay.includes(q.toLowerCase())

        const matchLoc = location === 'all' ? true : String(loc).toLowerCase() === location

        const inferredTier = getVerificationTier(p?.user ?? p)
        const matchTier =
          tier === 'all'
            ? true
            : tier === 'verified'
              ? tierRank(inferredTier) >= tierRank('bronze')
              : inferredTier === tier

        const rating = Number(p?.user?.rating ?? p?.rating ?? 0)
        const matchRating = minR == null ? true : rating >= minR

        const lat = p?.service_lat ?? p?.serviceLat ?? p?.user?.service_lat ?? null
        const lng = p?.service_lng ?? p?.serviceLng ?? p?.user?.service_lng ?? null
        const distKm = origin ? haversineKm(origin.lat, origin.lng, lat, lng) : null
        const matchRadius = radius == null ? true : distKm != null && distKm <= radius

        // Simple "best" score (0..1) — transparent UX, no ML.
        const skill01 = q ? (matchQ ? 1 : 0) : 0.5
        const dist01 = distKm == null ? 0.5 : Math.max(0, Math.min(1, 1 - distKm / 50))
        const tier01 = Math.min(1, tierRank(inferredTier) / tierRank('gold'))
        const rating01 = Math.max(0, Math.min(1, rating / 5))
        const score = 0.4 * skill01 + 0.25 * dist01 + 0.2 * tier01 + 0.15 * rating01

        const whyParts = []
        if (distKm != null) whyParts.push(`Near you (${formatKm(distKm)})`)
        if (skillFromQuery) whyParts.push(`Matches: ${skillFromQuery}`)
        else if (q) whyParts.push('Matches your search')
        if (inferredTier && inferredTier !== 'unverified') whyParts.push(`Tier: ${String(inferredTier).toUpperCase()}`)
        if (rating) whyParts.push(`★ ${rating.toFixed(1)}`)

        return {
          provider: p,
          inferredTier,
          rating,
          distKm,
          score,
          why: whyParts.length ? `Why: ${whyParts.join(' • ')}` : null,
          match: matchQ && matchLoc && matchTier && matchRating && matchRadius,
        }
      })
      .filter((x) => x.match)

    scored.sort((a, b) => {
      if (sort === 'nearest') return (a.distKm ?? 1e9) - (b.distKm ?? 1e9)
      if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sort === 'tier') return tierRank(b.inferredTier) - tierRank(a.inferredTier)
      return (b.score ?? 0) - (a.score ?? 0)
    })

    return scored
  }, [baseProviders, q, location, tier, minRating, nearLat, nearLng, radiusKm, sort, skillFromQuery])

  const results = useMemo(
    () =>
      viewMode === 'saved'
        ? savedProviders.map((p) => ({ ...p, meta: null }))
        : filtered.map((x) => ({ ...x.provider, meta: { why: x.why } })),
    [viewMode, savedProviders, filtered],
  )

  const canUseRadius = nearLat != null && nearLng != null
  const activeFilterCount = useMemo(() => {
    let n = 0
    if (q.trim()) n++
    if (location !== 'all') n++
    if (tier !== 'all') n++
    if (minRating !== 'all') n++
    if (canUseRadius && radiusKm !== 'all') n++
    return n
  }, [q, location, tier, minRating, canUseRadius, radiusKm])

  const radiusLabel = useMemo(() => {
    if (!canUseRadius) return 'Pick a location to enable radius'
    if (radiusKm === 'all') return 'Any distance'
    return `Within ${radiusKm} km`
  }, [canUseRadius, radiusKm])

  // Backwards compat: keep old API for callers below
  // eslint-disable-next-line no-unused-vars
  const _legacyFiltered = useMemo(() => {
    return baseProviders.filter((p) => {
      const name = p?.name ?? p?.user?.name ?? ''
      const skills = Array.isArray(p?.skills) ? p.skills.join(' ') : p?.skills ?? ''
      const loc =
        p?.service_area ??
        p?.serviceArea ??
        p?.location ??
        p?.city ??
        p?.user?.location ??
        ''

      const hay = `${name} ${skills} ${loc}`.toLowerCase()
      const matchQ = hay.includes(q.toLowerCase())

      const matchLoc = location === 'all' ? true : String(loc).toLowerCase() === location

      const inferredTier = getVerificationTier(p?.user ?? p)
      const matchTier =
        tier === 'all'
          ? true
          : tier === 'verified'
            ? tierRank(inferredTier) >= tierRank('bronze')
            : inferredTier === tier

      return matchQ && matchLoc && matchTier
    })
  }, [baseProviders, q, location, tier])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Providers"
        subtitle="Browse artisans with verification tiers and real profiles."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isBuyer ? (
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'all' ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All providers
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('saved')}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${viewMode === 'saved' ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  My trusted ({savedIds.size})
                </button>
              </div>
            ) : null}
            <div className="text-sm font-semibold text-slate-700">
              {loading || searchLoading || (viewMode === 'saved' && savedLoading) ? 'Loading…' : `${results.length} provider${results.length === 1 ? '' : 's'}${searchProviders !== null && viewMode === 'all' ? ' (search)' : ''}${viewMode === 'saved' ? ' saved' : ''}`}
            </div>
            <Button variant="secondary" size="sm" onClick={() => copyCurrentLink().catch(() => {})}>
              Copy link
            </Button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <div className={ui.label}>Search</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skill or name…" />
          </div>
          <div className="md:col-span-3">
            <div className={ui.label}>Location</div>
            <Select value={location} onChange={(e) => setLocation(e.target.value)}>
              <option value="all">All</option>
              {locations.map((loc) => (
                <option key={loc} value={loc.toLowerCase()}>
                  {loc}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className={ui.label}>Verification</div>
            <Select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="all">All</option>
              <option value="verified">Verified (any)</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
              <option value="unverified">Unverified</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className={ui.label}>Min rating</div>
            <Select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="all">Any</option>
              <option value="3">3.0+</option>
              <option value="3.5">3.5+</option>
              <option value="4">4.0+</option>
              <option value="4.5">4.5+</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className={ui.label}>Sort</div>
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="best">Best match</option>
              <option value="nearest" disabled={!canUseRadius}>
                Nearest
              </option>
              <option value="rating">Highest rated</option>
              <option value="tier">Most verified</option>
            </Select>
          </div>
          <div className="md:col-span-1">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setQ('')
                setLocation('all')
                setTier('all')
                setMinRating('all')
                setSort('best')
                setNear('')
                setNearLat(null)
                setNearLng(null)
                setRadiusKm('all')
              }}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div className={ui.label}>Near (radius filter)</div>
            <LocationInput
              value={near}
              onChange={(v) => {
                setNear(v)
                setNearLat(null)
                setNearLng(null)
              }}
              onPick={({ formatted, lat, lng }) => {
                setNear(formatted || near)
                setNearLat(typeof lat === 'number' ? lat : null)
                setNearLng(typeof lng === 'number' ? lng : null)
              }}
            />
          </div>
          <div className="md:col-span-3">
            <div className={ui.label}>Radius</div>
            <Select value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} disabled={!canUseRadius}>
              <option value="all">{radiusLabel}</option>
              <option value="5">5 km</option>
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-700">Active filters</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{activeFilterCount}</div>
          </div>
        </div>
      </Card>

      {(loading || (viewMode === 'saved' && savedLoading)) ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : viewMode === 'saved' && results.length === 0 ? (
        <EmptyState
          title="No saved providers yet"
          description="Browse providers and tap the heart to add them to My trusted. Then you can post jobs only to them or find them quickly here."
          actions={
            <Button variant="primary" onClick={() => setViewMode('all')}>
              Browse all providers
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No providers found"
          description="Try clearing filters or searching a broader skill."
          actions={
            <Button
              variant="secondary"
              onClick={() => {
                setQ('')
                setLocation('all')
                setTier('all')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => {
            const uid = p.user_id ?? p.user?.id ?? p.artisan_user_id
            return (
              <ProviderCard
                key={p.id ?? uid ?? `${p.created_at ?? ''}`}
                provider={p}
                meta={p.meta}
                showSaveButton={isBuyer}
                saved={savedIds.has(uid)}
                onSave={handleSave}
                onUnsave={handleUnsave}
              />
            )
          })}
        </div>
      )}

      <div className="text-xs text-slate-500">
        Tier rules (Phase 1): Bronze = verified, Silver = verified + docs/references, Gold = partner/on-site verified.
      </div>
    </div>
  )
}


