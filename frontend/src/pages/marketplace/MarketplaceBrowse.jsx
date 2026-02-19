import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { ProductCard } from '../../components/marketplace/ProductCard.jsx'
import { ServiceCard } from '../../components/marketplace/ServiceCard.jsx'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { haversineKm, formatKm } from '../../lib/geo.js'
import { getVerificationTier, tierRank } from '../../lib/verification.js'
import { ui } from '../../components/ui/tokens.js'
import { FARMER_FLORIST_MARKETPLACE_LABEL } from '../../lib/roles.js'
import { PRODUCT_CATEGORIES } from '../../lib/productCategories.js'

const TAB_PRODUCTS = 'products'
const TAB_SERVICES = 'services'

export function MarketplaceBrowse() {
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab = tabParam === 'services' ? TAB_SERVICES : TAB_PRODUCTS
  const [tab, setTab] = useState(initialTab)

  useEffect(() => {
    if (tabParam === 'services') setTab(TAB_SERVICES)
    else if (tabParam === 'products') setTab(TAB_PRODUCTS)
  }, [tabParam])

  const [products, setProducts] = useState([])
  const [searchProducts, setSearchProducts] = useState(null) // when q is set, results from GET /search
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [servicesError, setServicesError] = useState(null)

  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [location, setLocation] = useState('all')
  const [tier, setTier] = useState('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [sort, setSort] = useState('best')

  const [near, setNear] = useState('')
  const [nearLat, setNearLat] = useState(null)
  const [nearLng, setNearLng] = useState(null)
  const [radiusKm, setRadiusKm] = useState('all')

  const [serviceCategory, setServiceCategory] = useState('all')
  const [serviceSort, setServiceSort] = useState('price_asc')

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
        if (!cancelled) setServices(Array.isArray(res.data) ? res.data : [])
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

  const canUseRadius = nearLat != null && nearLng != null
  const radiusLabel = useMemo(() => {
    if (!canUseRadius) return 'Pick a location to enable radius'
    if (radiusKm === 'all') return 'Any distance'
    return `Within ${radiusKm} km`
  }, [canUseRadius, radiusKm])

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        subtitle={
          tab === TAB_PRODUCTS
            ? 'Produce, flowers & plants. Click the Services tab for provider services (catering, cleaning, repairs).'
            : 'Provider services — book catering, cleaning, repairs, and more from verified artisans.'
        }
        actions={
          <div className="flex items-center gap-4">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setTab(TAB_PRODUCTS)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === TAB_PRODUCTS ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {FARMER_FLORIST_MARKETPLACE_LABEL}
              </button>
              <button
                type="button"
                onClick={() => setTab(TAB_SERVICES)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === TAB_SERVICES ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Services
              </button>
            </div>
            <div className="text-sm font-semibold text-slate-700">
              {tab === TAB_PRODUCTS
                ? (loading || searchLoading ? 'Loading…' : `${results.length} item${results.length === 1 ? '' : 's'}${searchProducts !== null ? ' (search)' : ''}`)
                : (servicesLoading ? 'Loading…' : `${filteredServices.length} service${filteredServices.length === 1 ? '' : 's'}`)}
            </div>
          </div>
        }
      />

      {tab === TAB_SERVICES ? (
        <>
          <Card>
            <div className="grid gap-3 md:grid-cols-12 md:items-end">
              <div className="md:col-span-4">
                <div className={ui.label}>Category</div>
                <Select value={serviceCategory} onChange={(e) => setServiceCategory(e.target.value)}>
                  <option value="all">All</option>
                  {serviceCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-4">
                <div className={ui.label}>Sort</div>
                <Select value={serviceSort} onChange={(e) => setServiceSort(e.target.value)}>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="newest">Newest</option>
                </Select>
              </div>
              <div className="md:col-span-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    setServiceCategory('all')
                    setServiceSort('price_asc')
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </Card>
          <div>
            {servicesLoading ? (
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
            ) : servicesError ? (
              <Card>
                <div className="text-sm text-red-700">{servicesError}</div>
              </Card>
            ) : filteredServices.length === 0 ? (
              <EmptyState
                title="No services found"
                description="Try another category or check back later. Artisans add services from their dashboard."
                actions={
                  <Button variant="secondary" onClick={() => setServiceCategory('all')}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
      <Card>
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <div className={ui.label}>Search</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search produce, flowers, plants…" />
          </div>
          <div className="md:col-span-2">
            <div className={ui.label}>Category</div>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
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
          <div className="md:col-span-1">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
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
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-6">
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
          <div className="md:col-span-2">
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
            <div className={ui.label}>Min price (GHS)</div>
            <Input value={minPrice} onChange={(e) => setMinPrice(e.target.value)} type="number" min="0" placeholder="e.g. 20" />
          </div>
          <div className="md:col-span-2">
            <div className={ui.label}>Max price (GHS)</div>
            <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} type="number" min="0" placeholder="e.g. 150" />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-4">
            <div className={ui.label}>Sort</div>
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="best">Best (fresh + near + trust)</option>
              <option value="nearest" disabled={!canUseRadius}>
                Nearest
              </option>
              <option value="freshest">Freshest</option>
              <option value="cheapest">Cheapest</option>
            </Select>
          </div>
          <div className="md:col-span-8">
            <div className="text-xs text-slate-500">
              “Best” is a transparent score: freshness + near you + verification + match to your search.
            </div>
          </div>
        </div>
      </Card>

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
      )}
    </div>
  )
}


