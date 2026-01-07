import { useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http.js'
import { ProviderCard } from '../../components/providers/ProviderCard.jsx'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { getVerificationTier, tierRank } from '../../lib/verification.js'

export function BuyerProviders() {
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [q, setQ] = useState('')
  const [location, setLocation] = useState('all')
  const [tier, setTier] = useState('all')

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

  const locations = useMemo(() => {
    const set = new Set()
    for (const p of providers) {
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
  }, [providers])

  const filtered = useMemo(() => {
    return providers.filter((p) => {
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
  }, [providers, q, location, tier])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Providers</h1>
          <p className="text-sm text-slate-600">Browse artisans with real verification tiers.</p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search skill or name…" />
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="all">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc.toLowerCase()}>
                {loc}
              </option>
            ))}
          </Select>
          <Select value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="all">All tiers</option>
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
              setLocation('all')
              setTier('all')
            }}
          >
            Clear
          </Button>
        </div>
      </div>

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
          <div className="text-sm text-slate-600">No providers found.</div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProviderCard key={p.id ?? `${p.user_id ?? ''}-${p.created_at ?? ''}`} provider={p} />
          ))}
        </div>
      )}

      <div className="text-xs text-slate-500">
        Tier rules (Phase 1): Bronze = verified, Silver = verified + docs/references, Gold = partner/on-site verified.
      </div>
    </div>
  )
}


