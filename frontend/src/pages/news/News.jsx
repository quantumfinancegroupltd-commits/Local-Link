import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { usePageMeta } from '../../components/ui/seo.js'

function normalizeCategory(x) {
  return String(x || '')
    .trim()
    .toLowerCase()
}

function fmtDate(x) {
  try {
    return new Date(x).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function proxiedImage(url) {
  const u = String(url || '').trim()
  if (!u) return null
  if (u.startsWith('data:') || u.startsWith('/')) return u
  return `/api/news/image?src=${encodeURIComponent(u)}`
}

export function News() {
  usePageMeta({
    title: 'News • LocalLink',
    description: 'Product updates and announcements from LocalLink.',
  })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [section, setSection] = useState('all') // all | product | africa | articles

  const sections = useMemo(() => {
    const defs = [
      {
        key: 'all',
        label: 'All',
        match: () => true,
      },
      {
        key: 'product',
        label: 'Product updates & features',
        match: (p) => {
          const c = normalizeCategory(p?.category)
          return c === 'product updates' || c === 'product updates & features' || c === 'features' || c === 'announcements'
        },
      },
      {
        key: 'africa',
        label: 'Africa economics',
        match: (p) => normalizeCategory(p?.category) === 'africa economics',
      },
      {
        key: 'articles',
        label: 'Articles',
        match: (p) => {
          const c = normalizeCategory(p?.category)
          const isProduct = c === 'product updates' || c === 'product updates & features' || c === 'features' || c === 'announcements'
          const isAfrica = c === 'africa economics'
          return !isProduct && !isAfrica
        },
      },
    ]

    const counts = new Map()
    for (const p of Array.isArray(items) ? items : []) {
      for (const d of defs) {
        if (d.match(p)) counts.set(d.key, (counts.get(d.key) ?? 0) + 1)
      }
    }

    return defs.map((d) => ({ ...d, count: counts.get(d.key) ?? 0 }))
  }, [items])

  const visibleItems = useMemo(() => {
    const def = sections.find((s) => s.key === section) ?? sections[0]
    const src = Array.isArray(items) ? items : []
    return def?.match ? src.filter((p) => def.match(p)) : src
  }, [items, section, sections])

  const hasVisibleItems = useMemo(() => Array.isArray(visibleItems) && visibleItems.length > 0, [visibleItems])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await http.get('/news')
        if (!cancelled) setItems(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load news')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader kicker="Updates" title="News" subtitle="Product updates, announcements, and important information." />

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : !hasVisibleItems ? (
        <Card>
          <div className="text-sm text-slate-600">No posts in this section yet.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="sticky top-0 z-10 -mx-2 border-b bg-white/80 px-2 py-2 backdrop-blur">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sections.map((s) => {
                const active = s.key === section
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSection(s.key)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {s.label}
                    <span className={`ml-2 text-xs ${active ? 'text-white/80' : 'text-slate-600'}`}>{s.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {visibleItems.map((p) => (
            <Card key={p.id} className="p-5">
              {p.hero_image_url ? (
                <div className="mb-4 overflow-hidden rounded-2xl border bg-slate-50">
                  <img
                    src={proxiedImage(p.hero_image_url)}
                    alt={p.title ? `${p.title} cover` : 'News cover'}
                    className="h-48 w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Hide broken images gracefully
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/news/${p.slug}`} className="text-base font-semibold text-slate-900 hover:underline">
                    {p.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {p.category ? <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{p.category}</span> : null}
                    {p.published_at ? <span>{fmtDate(p.published_at)}</span> : null}
                  </div>
                </div>
              </div>
              {p.excerpt ? <div className="mt-3 text-sm text-slate-700">{String(p.excerpt).trim()}</div> : null}
              <div className="mt-3">
                <Link to={`/news/${p.slug}`} className="text-sm font-semibold text-emerald-700 hover:underline">
                  Read more
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

