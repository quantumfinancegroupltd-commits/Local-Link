import { useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http.js'
import { ProductCard } from '../../components/marketplace/ProductCard.jsx'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { getVerificationTier, tierRank } from '../../lib/verification.js'

export function MarketplaceBrowse() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [location, setLocation] = useState('all')
  const [tier, setTier] = useState('all')

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

  const locations = useMemo(() => {
    const set = new Set()
    for (const p of products) {
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
  }, [products])

  const filtered = useMemo(() => {
    return products.filter((p) => {
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

      return matchCat && matchLoc && matchQ && matchTier
    })
  }, [products, q, category, location, tier])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Farmers Marketplace</h1>
          <p className="text-sm text-slate-600">Browse produce with photos, filtered by category & location.</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search produce…" />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            <option value="vegetables">Vegetables</option>
            <option value="fruits">Fruits</option>
            <option value="grains">Grains</option>
            <option value="poultry">Poultry</option>
            <option value="other">Other</option>
          </Select>
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="all">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc.toLowerCase()}>
                {loc}
              </option>
            ))}
          </Select>
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">All verification</option>
            <option value="verified">Verified (any)</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="bronze">Bronze</option>
            <option value="unverified">Unverified</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setQ('')
              setCategory('all')
              setLocation('all')
              setTier('all')
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div>
        {loading ? (
          <Card>
            <div className="text-sm text-slate-600">Loading…</div>
          </Card>
        ) : error ? (
          <Card>
            <div className="text-sm text-red-700">{error}</div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-sm text-slate-600">No products found.</div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
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
    </div>
  )
}


