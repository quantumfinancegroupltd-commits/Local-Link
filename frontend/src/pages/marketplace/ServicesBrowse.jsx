import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { ServiceCard } from '../../components/marketplace/ServiceCard.jsx'
import { Button, Card, Select } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { BrowseLayout } from '../../components/layout/BrowseLayout.jsx'
import { BrowseMap } from '../../components/maps/BrowseMap.jsx'
import { ui } from '../../components/ui/tokens.js'

const CATEGORY_ORDER = ['Domestic Services', 'Events & Catering', 'Plumbing', 'Electrical', 'Masonry']

export function ServicesBrowse() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [serviceCategory, setServiceCategory] = useState(() => searchParams.get('serviceCategory') ?? 'all')
  const [serviceSort, setServiceSort] = useState(() => searchParams.get('serviceSort') ?? 'price_asc')

  useEffect(() => {
    const current = searchParams.toString()
    setServiceCategory(searchParams.get('serviceCategory') ?? 'all')
    setServiceSort(searchParams.get('serviceSort') ?? 'price_asc')
  }, [searchParams])

  function updateUrl(updates) {
    const next = new URLSearchParams(searchParams)
    const keys = ['serviceCategory', 'serviceSort']
    keys.forEach((k) => {
      const v = updates[k] !== undefined ? updates[k] : (k === 'serviceCategory' ? serviceCategory : serviceSort)
      if (v != null && String(v).trim() !== '' && String(v) !== 'all') next.set(k, String(v))
      else next.delete(k)
    })
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    setServiceCategory('all')
    setServiceSort('price_asc')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
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
          setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load services')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
        <div className={ui.label}>Category</div>
        <Select
          value={serviceCategory}
          onChange={(e) => {
            const v = e.target.value
            setServiceCategory(v)
            updateUrl({ serviceCategory: v })
          }}
          className="mt-1"
        >
          <option value="all">All</option>
          {serviceCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <div className={ui.label}>Sort</div>
        <Select
          value={serviceSort}
          onChange={(e) => {
            const v = e.target.value
            setServiceSort(v)
            updateUrl({ serviceSort: v })
          }}
          className="mt-1"
        >
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest first</option>
        </Select>
      </div>
      <Button variant="secondary" className="w-full" onClick={clearFilters}>
        Clear filters
      </Button>
    </div>
  )

  const mapCard = (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Map</h2>
      <BrowseMap
        pins={serviceMapPins}
        defaultZoom={serviceMapPins.length > 0 ? undefined : 6}
        emptyMessage="Add a service area with location in your Artisan profile to see pins on the map."
      />
    </div>
  )

  return (
    <BrowseLayout sidebar={filtersSidebar} sidebarBottom={mapCard}>
      <div className="space-y-6">
        <PageHeader
          title="Services"
          subtitle="Book plumbers, electricians, caterers, cleaners, masons and more from verified artisans."
          actions={
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {loading ? 'Loading…' : `${filteredServices.length} service${filteredServices.length === 1 ? '' : 's'}`}
            </span>
          }
        />

        {loading ? (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <div className="mb-4 h-7 w-48 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="relative -mx-2">
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <div
                        key={j}
                        className="h-64 w-72 flex-shrink-0 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <Card>
            <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
          </Card>
        ) : servicesByCategory.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Artisans add services from their dashboard. Check back soon."
          />
        ) : (
          <div className="space-y-8">
            {servicesByCategory.map(({ category, services: catServices }) => (
              <div key={category}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className={ui.h2}>{category}</h2>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {catServices.length} service{catServices.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="relative -mx-2">
                  <div
                    className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory scrollbar-thin"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {catServices.map((s) => (
                      <div key={s.id} className="w-72 flex-shrink-0 snap-start">
                        <ServiceCard service={s} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BrowseLayout>
  )
}
