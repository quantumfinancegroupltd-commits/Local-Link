import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { ProductCard } from '../../components/marketplace/ProductCard.jsx'
import { ServiceCard } from '../../components/marketplace/ServiceCard.jsx'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { BrowseLayout } from '../../components/layout/BrowseLayout.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { BrowseMap } from '../../components/maps/BrowseMap.jsx'
import { haversineKm, formatKm } from '../../lib/geo.js'
import { imageProxySrc } from '../../lib/imageProxy.js'
import { getVerificationTier, tierRank } from '../../lib/verification.js'
import { ui } from '../../components/ui/tokens.js'
import { FARMER_FLORIST_MARKETPLACE_LABEL } from '../../lib/roles.js'
import { PRODUCT_CATEGORIES } from '../../lib/productCategories.js'

export function MarketplaceBrowse() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [products, setProducts] = useState([])
  const [searchProducts, setSearchProducts] = useState(null) // when q is set, results from GET /search
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesError, setServicesError] = useState(null)

  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [category, setCategory] = useState(() => searchParams.get('category') ?? 'all')
  const [location, setLocation] = useState(() => searchParams.get('location') ?? 'all')
  const [tier, setTier] = useState(() => searchParams.get('tier') ?? 'all')
  const [minPrice, setMinPrice] = useState(() => searchParams.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(() => searchParams.get('maxPrice') ?? '')
  const [sort, setSort] = useState(() => searchParams.get('sort') ?? 'best')

  const [near, setNear] = useState('')
  const [nearLat, setNearLat] = useState(null)
  const [nearLng, setNearLng] = useState(null)
  const [radiusKm, setRadiusKm] = useState(() => searchParams.get('radiusKm') ?? 'all')

  const [serviceCategory, setServiceCategory] = useState(() => searchParams.get('serviceCategory') ?? 'all')
  const [serviceSort, setServiceSort] = useState(() => searchParams.get('serviceSort') ?? 'price_asc')

  const prevParamsRef = useRef(searchParams.toString())
  useEffect(() => {
    const current = searchParams.toString()
    if (current === prevParamsRef.current) return
    prevParamsRef.current = current
    setQ(searchParams.get('q') ?? '')
    setCategory(searchParams.get('category') ?? 'all')
    setLocation(searchParams.get('location') ?? 'all')
    setTier(searchParams.get('tier') ?? 'all')
    setMinPrice(searchParams.get('minPrice') ?? '')
    setMaxPrice(searchParams.get('maxPrice') ?? '')
    setSort(searchParams.get('sort') ?? 'best')
    setRadiusKm(searchParams.get('radiusKm') ?? 'all')
    }, [searchParams])

  function updateProductUrl(updates) {
    const next = new URLSearchParams(searchParams)
    const keys = ['q', 'category', 'location', 'tier', 'minPrice', 'maxPrice', 'sort', 'radiusKm']
    keys.forEach((k) => {
      const v = updates[k] !== undefined ? updates[k] : (k === 'q' ? q : k === 'category' ? category : k === 'location' ? location : k === 'tier' ? tier : k === 'minPrice' ? minPrice : k === 'maxPrice' ? maxPrice : k === 'sort' ? sort : radiusKm)
      if (v != null && String(v).trim() !== '' && String(v) !== 'all') next.set(k, String(v))
      else next.delete(k)
    })
    prevParamsRef.current = next.toString()
    setSearchParams(next, { replace: true })
  }
  function updateServiceUrl(updates) {
    const next = new URLSearchParams(searchParams)
    const keys = ['serviceCategory', 'serviceSort']
    keys.forEach((k) => {
      const v = updates[k] !== undefined ? updates[k] : (k === 'serviceCategory' ? serviceCategory : serviceSort)
      if (v != null && String(v).trim() !== '' && String(v) !== 'all') next.set(k, String(v))
      else next.delete(k)
    })
    prevParamsRef.current = next.toString()
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/products')
        if (!cancelled) setProducts(Array.isArray(res.data) ? res.data : res.data?.products ?? [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load products')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Pre-load services on mount so the Services tab shows count and data is ready when user clicks
  useEffect(() => {
    let cancelled = false
    setServicesLoading(true)
    setServicesError(null)
    http
      .get('/marketplace/services')
      .then((res) => {
        const data = res.data
        const list = Array.isArray(data) ? data : (data?.services ?? [])
        if (!cancelled) setServices(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setServices([])
          setServicesError(err?.response?.data?.message ?? err?.message ?? 'Failed to load services')
        }
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Server-side full-text search when user types in search box
  useEffect(() => {
    const term = String(q ?? '').trim()
    if (!term) {
      setSearchProducts(null)
      return
    }
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await http.get('/search', { params: { q: term, type: 'products', limit: 100 } })
        const list = Array.isArray(res.data?.products) ? res.data.products : []
        setSearchProducts(list.map((p) => ({ ...p, location: p.location ?? p.farm_location })))
      } catch {
        setSearchProducts([])
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q])


  const baseProducts = searchProducts !== null ? searchProducts : products

  const locations = useMemo(() => {
    const set = new Set()
    for (const p of baseProducts) {
      const loc =
        p?.location ??
        p?.farm_location ??
        p?.farmLocation ??
        p?.farmer_location ??
        p?.farmerLocation ??
        null
      if (typeof loc === 'string' && loc.trim()) set.add(loc.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [baseProducts])

  const filtered = useMemo(() => {
    const origin = nearLat != null && nearLng != null ? { lat: Number(nearLat), lng: Number(nearLng) } : null
    const radius = radiusKm === 'all' ? null : Number(radiusKm)
    const minP = minPrice ? Number(minPrice) : null
    const maxP = maxPrice ? Number(maxPrice) : null

    const scored = baseProducts
      .map((p) => {
      const matchCat =
        category === 'all' ? true : String(p.category ?? '').toLowerCase() === category
      const loc =
        p?.location ??
        p?.farm_location ??
        p?.farmLocation ??
        p?.farmer_location ??
        p?.farmerLocation ??
        ''
      const matchLoc = location === 'all' ? true : String(loc).toLowerCase() === location
      const hay = `${p.name ?? ''} ${p.category ?? ''} ${loc ?? ''}`.toLowerCase()
      const matchQ = hay.includes(q.toLowerCase())

      const verifyEntity =
        p?.farmer ?? p?.farmer_profile ?? p?.farmerProfile ?? p?.farmer_user ?? p?.farmerUser ?? p
      const inferredTier = getVerificationTier(verifyEntity)
      const matchTier =
        tier === 'all'
          ? true
          : tier === 'verified'
            ? tierRank(inferredTier) >= tierRank('bronze')
            : inferredTier === tier

      const price = Number(p?.price ?? 0)
      const matchPriceMin = minP == null ? true : price >= minP
      const matchPriceMax = maxP == null ? true : price <= maxP

      const lat = p?.farm_lat ?? p?.farmLat ?? p?.farmer?.farm_lat ?? null
      const lng = p?.farm_lng ?? p?.farmLng ?? p?.farmer?.farm_lng ?? null
      const distKm = origin ? haversineKm(origin.lat, origin.lng, lat, lng) : null
      const matchRadius = radius == null ? true : distKm != null && distKm <= radius

      const createdAt = p?.created_at ? new Date(p.created_at) : null
      const ageDays = createdAt ? (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24) : null
      const freshness01 = ageDays == null ? 0.5 : Math.max(0, Math.min(1, 1 - ageDays / 7))

      const dist01 = distKm == null ? 0.5 : Math.max(0, Math.min(1, 1 - distKm / 60))
      const tier01 = Math.min(1, tierRank(inferredTier) / tierRank('gold'))
      const query01 = q ? (matchQ ? 1 : 0) : 0.5
      const score = 0.35 * freshness01 + 0.3 * dist01 + 0.2 * tier01 + 0.15 * query01

      const whyParts = []
      if (distKm != null) whyParts.push(`Near you (${formatKm(distKm)})`)
      if (ageDays != null) whyParts.push(ageDays < 1 ? 'Fresh (today)' : `Freshness: ${Math.round(ageDays)}d`)
      if (inferredTier && inferredTier !== 'unverified') whyParts.push(`Tier: ${String(inferredTier).toUpperCase()}`)
      if (q) whyParts.push('Matches your search')

      return {
        product: p,
        inferredTier,
        distKm,
        freshness01,
        score,
        why: whyParts.length ? `Why: ${whyParts.join(' • ')}` : null,
        match: matchCat && matchLoc && matchQ && matchTier && matchPriceMin && matchPriceMax && matchRadius,
      }
    })
      .filter((x) => x.match)

    scored.sort((a, b) => {
      if (sort === 'nearest') return (a.distKm ?? 1e9) - (b.distKm ?? 1e9)
      if (sort === 'cheapest') return Number(a.product?.price ?? 0) - Number(b.product?.price ?? 0)
      if (sort === 'freshest') return (b.freshness01 ?? 0) - (a.freshness01 ?? 0)
      return (b.score ?? 0) - (a.score ?? 0)
    })

    return scored
  }, [baseProducts, q, category, location, tier, minPrice, maxPrice, nearLat, nearLng, radiusKm, sort])

  const results = useMemo(() => filtered.map((x) => ({ ...x.product, meta: { why: x.why } })), [filtered])

  const productMapPins = useMemo(() => {
    return results
      .filter((p) => {
        const rawLat = p?.farm_lat ?? p?.farmLat ?? p?.farmer?.farm_lat ?? null
        const rawLng = p?.farm_lng ?? p?.farmLng ?? p?.farmer?.farm_lng ?? null
        const lat = rawLat != null ? Number(rawLat) : NaN
        const lng = rawLng != null ? Number(rawLng) : NaN
        return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      })
      .map((p) => {
        const rawLat = p?.farm_lat ?? p?.farmLat ?? p?.farmer?.farm_lat ?? 0
        const rawLng = p?.farm_lng ?? p?.farmLng ?? p?.farmer?.farm_lng ?? 0
        const lat = Number(rawLat) || 0
        const lng = Number(rawLng) || 0
        const loc =
          p?.location ??
          p?.farm_location ??
          p?.farmLocation ??
          p?.farmer_location ??
          p?.farmerLocation ??
          ''
        const mediaFirst = Array.isArray(p?.media) && p.media.length ? p.media.find((m) => m?.kind === 'image' && m?.url) : null
        const imgUrl = mediaFirst?.url || p?.image_url || p?.imageUrl || p?.photo_url || p?.photoUrl || null
        const priceLabel = p?.price != null ? `GHS ${Number(p.price).toFixed(0)}` : undefined
        return {
          id: p.id,
          lat,
          lng,
          title: p?.name ?? 'Product',
          subtitle: String(loc).trim() || undefined,
          href: `/marketplace/products/${p.id}`,
          imageUrl: imgUrl ? (imageProxySrc(imgUrl) || imgUrl) : undefined,
          priceLabel,
        }
      })
  }, [results])

  const canUseRadius = nearLat != null && nearLng != null
  const radiusLabel = useMemo(() => {
    if (!canUseRadius) return 'Pick a location to enable radius'
    if (radiusKm === 'all') return 'Any distance'
    return `Within ${radiusKm} km`
  }, [canUseRadius, radiusKm])

  function clearProductFilters() {
    setQ('')
    setCategory('all')
    setLocation('all')
    setTier('all')
    setMinPrice('')
    setMaxPrice('')
    setSort('best')
    setNear('')
    setNearLat(null)
    setNearLng(null)
    setRadiusKm('all')
    const next = new URLSearchParams(searchParams)
    ;['q', 'category', 'location', 'tier', 'minPrice', 'maxPrice', 'sort', 'radiusKm'].forEach((k) => next.delete(k))
    prevParamsRef.current = next.toString()
    setSearchParams(next, { replace: true })
  }
  function clearServiceFilters() {
    setServiceCategory('all')
    setServiceSort('price_asc')
    const next = new URLSearchParams(searchParams)
    next.delete('serviceCategory')
    next.delete('serviceSort')
    prevParamsRef.current = next.toString()
    setSearchParams(next, { replace: true })
  }

  const serviceCategories = useMemo(() => {
    const set = new Set()
    for (const s of services) {
      const c = s?.category ?? ''
      if (String(c).trim()) set.add(String(c).trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [services])

  const filteredServices = useMemo(() => {
    let list = [...services]
    if (serviceCategory !== 'all') {
      list = list.filter((s) => String(s?.category ?? '').trim() === serviceCategory)
    }
    if (serviceSort === 'price_asc') list.sort((a, b) => Number(a?.price ?? 0) - Number(b?.price ?? 0))
    else if (serviceSort === 'price_desc') list.sort((a, b) => Number(b?.price ?? 0) - Number(a?.price ?? 0))
    else if (serviceSort === 'newest') list.sort((a, b) => new Date(b?.created_at ?? 0) - new Date(a?.created_at ?? 0))
    return list
  }, [services, serviceCategory, serviceSort])

  // Group services by category for carousel sections (display order for known categories)
  const CATEGORY_ORDER = ['Domestic Services', 'Events & Catering', 'Plumbing', 'Electrical', 'Masonry']
  const servicesByCategory = useMemo(() => {
    const byCat = new Map()
    for (const s of filteredServices) {
      const c = String(s?.category ?? '').trim() || 'Other'
      if (!byCat.has(c)) byCat.set(c, [])
      byCat.get(c).push(s)
    }
    const ordered = []
    for (const cat of CATEGORY_ORDER) {
      if (byCat.has(cat)) ordered.push({ category: cat, services: byCat.get(cat) })
    }
    const rest = [...byCat.keys()].filter((c) => !CATEGORY_ORDER.includes(c)).sort((a, b) => a.localeCompare(b))
    for (const cat of rest) ordered.push({ category: cat, services: byCat.get(cat) })
    return ordered
  }, [filteredServices])

  const serviceMapPins = useMemo(() => {
    return filteredServices
      .filter((s) => {
        const rawLat = s?.service_lat ?? s?.serviceLat ?? null
        const rawLng = s?.service_lng ?? s?.serviceLng ?? null
        const lat = rawLat != null ? Number(rawLat) : NaN
        const lng = rawLng != null ? Number(rawLng) : NaN
        return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      })
      .map((s) => {
        const rawLat = s?.service_lat ?? s?.serviceLat ?? 0
        const rawLng = s?.service_lng ?? s?.serviceLng ?? 0
        const lat = Number(rawLat) || 0
        const lng = Number(rawLng) || 0
        const subtitle = [s?.artisan_name, s?.service_area].filter(Boolean).join(' · ') || undefined
        const serviceImg = s?.image_url || s?.imageUrl || s?.photo_url || null
        const artisanPic = s?.artisan?.profile_pic ?? s?.artisan_profile_pic ?? s?.user?.profile_pic ?? null
        const imgUrl = serviceImg || artisanPic || null
        const currency = s?.currency ?? 'GHS'
        const price = s?.price ?? 0
        const durMin = s?.duration_minutes ?? s?.durationMinutes
        const durationStr = durMin != null && durMin > 0
          ? (durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)}h${durMin % 60 ? ` ${durMin % 60}m` : ''}`)
          : ''
        const priceLabel = price != null || durationStr
          ? `${currency} ${Number(price).toFixed(0)}${durationStr ? ` · ${durationStr}` : ''}`
          : undefined
        return {
          id: s.id,
          lat,
          lng,
          title: s?.title ?? 'Service',
          subtitle: subtitle || undefined,
          href: `/profile/${s.artisan_user_id}`,
          imageUrl: imgUrl || undefined,
          priceLabel,
        }
      })
  }, [filteredServices])

  const filtersSidebar = (
      <div className="space-y-4">
        <div className="text-sm font-semibold text-slate-800 dark:text-white">Filters</div>
        <div>
          <div className={ui.label}>Search</div>
          <Input value={q} onChange={(e) => { const v = e.target.value; setQ(v); updateProductUrl({ q: v }) }} placeholder="Produce, flowers, plants…" className="mt-1" />
        </div>
        <div>
          <div className={ui.label}>Category</div>
          <Select value={category} onChange={(e) => { const v = e.target.value; setCategory(v); updateProductUrl({ category: v }) }} className="mt-1">
            <option value="all">All</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <div className={ui.label}>Location</div>
          <Select value={location} onChange={(e) => { const v = e.target.value; setLocation(v); updateProductUrl({ location: v }) }} className="mt-1">
            <option value="all">All</option>
            {locations.map((loc) => (
              <option key={loc} value={loc.toLowerCase()}>{loc}</option>
            ))}
          </Select>
        </div>
        <div>
          <div className={ui.label}>Verification</div>
          <Select value={tier} onChange={(e) => { const v = e.target.value; setTier(v); updateProductUrl({ tier: v }) }} className="mt-1">
            <option value="all">All</option>
            <option value="verified">Verified (any)</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
            <option value="unverified">Unverified</option>
          </Select>
        </div>
        <div>
          <div className={ui.label}>Near (radius)</div>
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
        <div>
          <div className={ui.label}>Radius</div>
          <Select value={radiusKm} onChange={(e) => { const v = e.target.value; setRadiusKm(v); updateProductUrl({ radiusKm: v }) }} disabled={!canUseRadius} className="mt-1">
            <option value="all">{radiusLabel}</option>
            <option value="5">5 km</option>
            <option value="10">10 km</option>
            <option value="25">25 km</option>
            <option value="50">50 km</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={ui.label}>Min price (GHS)</div>
            <Input value={minPrice} onChange={(e) => { const v = e.target.value; setMinPrice(v); updateProductUrl({ minPrice: v }) }} type="number" min="0" placeholder="Min" className="mt-1" />
          </div>
          <div>
            <div className={ui.label}>Max price (GHS)</div>
            <Input value={maxPrice} onChange={(e) => { const v = e.target.value; setMaxPrice(v); updateProductUrl({ maxPrice: v }) }} type="number" min="0" placeholder="Max" className="mt-1" />
          </div>
        </div>
        <div>
          <div className={ui.label}>Sort</div>
          <Select value={sort} onChange={(e) => { const v = e.target.value; setSort(v); updateProductUrl({ sort: v }) }} className="mt-1">
            <option value="best">Best (fresh + near + trust)</option>
            <option value="nearest" disabled={!canUseRadius}>Nearest</option>
            <option value="freshest">Freshest</option>
            <option value="cheapest">Cheapest</option>
          </Select>
        </div>
        <Button variant="secondary" className="w-full" onClick={clearProductFilters}>
          Clear filters
        </Button>
      </div>
  )

  const mapCard = (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Map</h2>
      <BrowseMap
        pins={productMapPins}
        defaultCenter={
          nearLat != null && nearLng != null ? { lat: nearLat, lng: nearLng } : undefined
        }
        defaultZoom={productMapPins.length > 0 ? undefined : 6}
        emptyMessage="Farmers with a set farm location will show as pins. Pick a location or browse to see listings."
      />
    </div>
  )

  return (
    <BrowseLayout sidebar={filtersSidebar} sidebarBottom={mapCard}>
      <div className="space-y-6">
        <PageHeader
          title="Marketplace"
          subtitle="Produce, flowers & plants from local farmers and florists."
          actions={
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {loading || searchLoading ? 'Loading…' : `${results.length} item${results.length === 1 ? '' : 's'}${searchProducts !== null ? ' (search)' : ''}`}
            </span>
          }
        />

      <>
      <div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="text-sm text-red-700">{error}</div>
          </Card>
        ) : results.length === 0 ? (
          <EmptyState
            title="No products found"
            description="Try clearing filters or searching a broader term."
            actions={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ('')
                  setCategory('all')
                  setLocation('all')
                  setTier('all')
                  setMinPrice('')
                  setMaxPrice('')
                  setSort('best')
                  setNear('')
                  setNearLat(null)
                  setNearLng(null)
                  setRadiusKm('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {!loading && !error && locations.length === 0 && (
          <div className="mt-4 text-xs text-slate-500">
            Tip: to enable “Location” filtering from the backend, include a location field on products (or return the farmer’s farm location).
          </div>
        )}
      </div>
      </>
      </div>
    </BrowseLayout>
  )
}


