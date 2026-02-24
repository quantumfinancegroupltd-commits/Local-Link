import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { usePageMeta } from '../../components/ui/seo.js'

function QuickLink({ to, label, description }) {
  return (
    <Link to={to} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
      <div className="font-semibold text-slate-900">{label}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </Link>
  )
}

function ProviderRow({ p }) {
  const to = p?.user_id ? `/u/${encodeURIComponent(p.user_id)}` : '/people'
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-200">
      <img src={p?.profile_pic || '/locallink-logo.png'} alt="" className="h-12 w-12 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{p?.name ?? 'Provider'}</div>
        <div className="text-xs text-slate-500">{[p?.primary_skill, p?.service_area].filter(Boolean).join(' • ') || p?.role}</div>
      </div>
      <span className="text-xs font-medium text-emerald-700">View</span>
    </Link>
  )
}

function ProductRow({ p }) {
  const to = `/marketplace/products/${encodeURIComponent(p?.id ?? '')}`
  return (
    <Link to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-200">
      {p?.image_url ? (
        <img src={p.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">—</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{p?.name ?? 'Product'}</div>
        <div className="text-xs text-slate-500">{p?.category} {p?.price != null ? `• GHS ${Number(p.price)}` : ''}</div>
      </div>
      <span className="text-xs font-medium text-emerald-700">View</span>
    </Link>
  )
}

export function Discover() {
  const [params, setParams] = useSearchParams()
  const qParam = params.get('q') ?? ''
  const [query, setQuery] = useState(qParam)
  const [searchQ, setSearchQ] = useState(qParam)
  const [results, setResults] = useState({ products: [], providers: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  usePageMeta({ title: 'Discover • LocalLink', description: 'Search services, jobs and produce.' })

  useEffect(() => {
    setQuery(qParam)
    setSearchQ(qParam)
  }, [qParam])

  useEffect(() => {
    if (!searchQ.trim()) {
      setResults({ products: [], providers: [] })
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    http.get('/search', { params: { q: searchQ.trim(), type: 'all', limit: 12 } })
      .then((res) => {
        if (!cancelled) setResults({ products: res.data?.products ?? [], providers: res.data?.providers ?? [] })
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Search failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [searchQ])

  function handleSubmit(e) {
    e.preventDefault()
    const v = String(query ?? '').trim()
    setSearchQ(v)
    if (v) setParams({ q: v }, { replace: true })
  }

  const hasQuery = searchQ.trim().length > 0
  const hasResults = results.providers.length > 0 || results.products.length > 0

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <PageHeader
        kicker="Discover"
        title="Search services, jobs or produce"
        subtitle="Find providers, fresh produce and opportunities."
      />

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="search"
          placeholder="Search services, jobs or produce…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-xl border-slate-200"
          autoFocus
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="grid gap-6 sm:grid-cols-3">
        <QuickLink to="/buyer/providers" label="Find providers" description="Skilled artisans near you" />
        <QuickLink to="/marketplace" label="Browse produce" description="Fresh produce & flowers" />
        <QuickLink to="/jobs" label="Jobs & offers" description="Employment opportunities" />
      </div>

      {hasQuery && (
        <>
          {loading ? (
            <Card className="p-6 text-center text-slate-600">Searching…</Card>
          ) : error ? (
            <Card className="p-6 text-sm text-red-700">{error}</Card>
          ) : !hasResults ? (
            <Card className="p-6 text-center text-slate-600">
              No results for &quot;{searchQ}&quot;. Try different keywords or browse the links above.
            </Card>
          ) : (
            <div className="space-y-6">
              {results.providers.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Providers</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.providers.slice(0, 6).map((p) => (
                      <ProviderRow key={p?.user_id ?? p?.artisan_id ?? p?.name} p={p} />
                    ))}
                  </div>
                  <Link to={`/buyer/providers?q=${encodeURIComponent(searchQ)}`} className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
                    See all providers →
                  </Link>
                </div>
              )}
              {results.products.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-slate-900">Produce</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {results.products.slice(0, 6).map((p) => (
                      <ProductRow key={p?.id} p={p} />
                    ))}
                  </div>
                  <Link to={`/marketplace?q=${encodeURIComponent(searchQ)}`} className="mt-2 inline-block text-sm font-medium text-emerald-700 hover:underline">
                    See all produce →
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
