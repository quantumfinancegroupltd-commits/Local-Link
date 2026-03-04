import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Card } from '../../components/ui/FormControls.jsx'
import { usePageMeta } from '../../components/ui/seo.js'

const INITIAL_BATCH = 8
const LOAD_MORE_BATCH = 8

function normalizeCategory(x) {
  return String(x || '')
    .trim()
    .toLowerCase()
    .replace(/\s+&\s+/g, ' ')
    .replace(/\s+/g, ' ')
}

/** Map API category to pill slug for filtering and badge styling */
function postToSlug(p) {
  const c = normalizeCategory(p?.category)
  if (!c) return 'articles'
  if (/^product|^features|^announcements/.test(c) || c.includes('product update')) return 'product'
  if (c.includes('africa')) return 'africa'
  if (c.includes('hiring guide')) return 'guides'
  if (c.includes('worker spotlight') || c.includes('worker story')) return 'workers'
  if (c.includes('employer tip')) return 'employers'
  if (c.includes('safety') || c.includes('compliance')) return 'safety'
  if (c.includes('legal') || c.includes('pay')) return 'legal'
  return 'articles'
}

const CATEGORY_DEFS = [
  { key: 'all', label: 'All', slug: null },
  { key: 'product', label: 'Product updates & features', slug: 'product' },
  { key: 'africa', label: 'Africa economics', slug: 'africa' },
  { key: 'articles', label: 'Articles', slug: 'articles' },
  { key: 'guides', label: 'Hiring guides', slug: 'guides' },
  { key: 'workers', label: 'Worker spotlight', slug: 'workers' },
  { key: 'employers', label: 'Employer tips', slug: 'employers' },
  { key: 'safety', label: 'Safety & compliance', slug: 'safety' },
  { key: 'legal', label: 'Legal & pay', slug: 'legal' },
]

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

/** Rough read time in min from excerpt/body length */
function readTime(post) {
  const text = String(post?.excerpt || post?.summary || post?.body || '').trim()
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

const BADGE_CLASS = {
  product: 'bg-blue-500/20 text-blue-400 dark:bg-blue-500/25 dark:text-blue-300',
  africa: 'bg-amber-500/20 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400',
  articles: 'bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400',
  guides: 'bg-purple-500/20 text-purple-400 dark:bg-purple-500/25 dark:text-purple-300',
  workers: 'bg-teal-500/20 text-teal-500 dark:bg-teal-500/25 dark:text-teal-400',
  employers: 'bg-orange-500/20 text-orange-500 dark:bg-orange-500/25 dark:text-orange-400',
  safety: 'bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/25 dark:text-yellow-400',
  legal: 'bg-indigo-500/20 text-indigo-400 dark:bg-indigo-500/25 dark:text-indigo-300',
}

const IMG_GRADIENT = {
  product: 'bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black',
  africa: 'bg-gradient-to-br from-amber-900/40 to-amber-950/50 dark:from-amber-950/50 dark:to-black',
  articles: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/50 dark:from-emerald-950/50 dark:to-black',
  guides: 'bg-gradient-to-br from-purple-900/40 to-purple-950/50 dark:from-purple-950/50 dark:to-black',
  workers: 'bg-gradient-to-br from-teal-900/40 to-teal-950/50 dark:from-teal-950/50 dark:to-black',
  employers: 'bg-gradient-to-br from-orange-900/40 to-orange-950/50 dark:from-orange-950/50 dark:to-black',
  safety: 'bg-gradient-to-br from-yellow-900/30 to-amber-950/50 dark:from-yellow-950/30 dark:to-black',
  legal: 'bg-gradient-to-br from-indigo-900/40 to-indigo-950/50 dark:from-indigo-950/50 dark:to-black',
}

const PLACEHOLDER_EMOJI = {
  product: '📣',
  africa: '📈',
  articles: '📄',
  guides: '🏗️',
  workers: '👨‍🔧',
  employers: '🏢',
  safety: '⚠️',
  legal: '⚖️',
}

function ArticleCard({ post, compact = false }) {
  const slug = postToSlug(post)
  const excerpt = String(post?.excerpt || post?.summary || '').trim()
  const imgUrl = post?.hero_image_url ? proxiedImage(post.hero_image_url) : null
  const gradient = IMG_GRADIENT[slug] || IMG_GRADIENT.articles
  const emoji = PLACEHOLDER_EMOJI[slug] || '📄'
  const badgeClass = BADGE_CLASS[slug] || BADGE_CLASS.articles
  const categoryLabel = post?.category || 'Articles'

  return (
    <Link
      to={`/news/${post.slug}`}
      className={`block overflow-hidden rounded-2xl border border-slate-200 bg-white text-left no-underline shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 ${
        compact ? '' : ''
      }`}
    >
      <div
        className={`relative flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 ${gradient} ${compact ? 'h-32' : 'h-56'}`}
      >
        {imgUrl ? (
          <>
            <img
              src={imgUrl}
              alt={post.hero_image_alt || ''}
              className={`w-full object-cover ${compact ? 'h-32' : 'h-56'}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.nextElementSibling
                if (fallback) fallback.classList.remove('hidden')
              }}
            />
            <span
              className={`hidden flex items-center justify-center text-slate-400 dark:text-slate-500 ${compact ? 'text-4xl' : 'text-6xl'}`}
              aria-hidden
            >
              {emoji}
            </span>
          </>
        ) : (
          <span
            className={`flex items-center justify-center text-slate-400 dark:text-slate-500 ${compact ? 'text-4xl' : 'text-6xl'}`}
            aria-hidden
          >
            {emoji}
          </span>
        )}
      </div>
      <div className={compact ? 'p-4' : 'p-5'}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
          >
            {categoryLabel}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {fmtDate(post.published_at)}
          </span>
          {!compact ? (
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">
              {readTime(post)} min
            </span>
          ) : null}
        </div>
        <h2
          className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-sm leading-snug' : 'text-lg leading-snug'} mb-1.5`}
        >
          {post.title}
        </h2>
        {excerpt ? (
          <p
            className={`text-slate-600 dark:text-slate-300 ${compact ? 'text-xs leading-relaxed line-clamp-2' : 'text-sm leading-relaxed line-clamp-3'}`}
          >
            {excerpt}
          </p>
        ) : null}
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Read more →
        </span>
      </div>
    </Link>
  )
}

const STATS = [
  { value: '12,400+', label: 'Verified workers' },
  { value: '98%', label: 'Jobs completed' },
  { value: 'GH₵ 2.1M', label: 'Paid to workers' },
  { value: '47 trades', label: 'Categories covered' },
]

export function News() {
  usePageMeta({
    title: 'News & Insights • LocalLink',
    description: 'Product updates, hiring guides, worker stories, legal know-how, and Ghana-first business intelligence.',
  })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [section, setSection] = useState('all')
  const [showCount, setShowCount] = useState(INITIAL_BATCH)
  const [newsletterEmail, setNewsletterEmail] = useState('')

  const sectionsWithCounts = useMemo(() => {
    const counts = new Map()
    counts.set('all', items.length)
    for (const p of items) {
      const s = postToSlug(p)
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return CATEGORY_DEFS.map((d) => ({
      ...d,
      count: d.key === 'all' ? counts.get('all') ?? 0 : counts.get(d.key) ?? 0,
    }))
  }, [items])

  const visibleItems = useMemo(() => {
    const list = section === 'all' ? items : items.filter((p) => postToSlug(p) === section)
    return [...list].sort((a, b) => {
      const ta = a?.published_at ? new Date(a.published_at).getTime() : 0
      const tb = b?.published_at ? new Date(b.published_at).getTime() : 0
      return tb - ta
    })
  }, [items, section])

  const displayedItems = useMemo(
    () => visibleItems.slice(0, showCount),
    [visibleItems, showCount]
  )
  const hasMore = visibleItems.length > showCount

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

  const handleLoadMore = () => {
    setShowCount((n) => n + LOAD_MORE_BATCH)
  }

  const showStatsAndNewsletter = section === 'all'

  return (
    <div className="mx-auto max-w-3xl space-y-0">
      {/* Page header */}
      <div className="pb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Updates
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">
          News & Insights
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Product updates, hiring guides, worker stories, legal know-how, and Ghana-first business
          intelligence.
        </p>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-6 dark:border-white/10">
        {sectionsWithCounts.map((s) => {
          const active = s.key === section
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setSection(s.key)
                setShowCount(INITIAL_BATCH)
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                active
                  ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-white/20 dark:bg-white/15 dark:text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              {s.label}
              <span
                className={`text-xs ${active ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}
              >
                {s.count}
              </span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <Card className="py-12 text-center text-slate-600 dark:text-slate-400">
          Loading…
        </Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700 dark:text-red-400">{error}</div>
        </Card>
      ) : visibleItems.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            No posts in this category yet.
          </div>
        </Card>
      ) : (
        <div className="space-y-4 pb-8">
          {displayedItems.length > 0 && (
            <ArticleCard key={displayedItems[0].id} post={displayedItems[0]} compact={false} />
          )}
          {displayedItems.length > 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {displayedItems.slice(1).map((post) => (
                <ArticleCard key={post.id} post={post} compact />
              ))}
            </div>
          )}

          {showStatsAndNewsletter && (
            <>
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 md:grid-cols-4">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white py-5 text-center dark:bg-white/5"
                  >
                    <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 md:text-2xl">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/5 md:flex md:items-center md:gap-6">
                <span className="text-3xl" aria-hidden>📬</span>
                <div className="mt-3 flex-1 md:mt-0">
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Get the weekly LocalLink briefing
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Ghana labour news, hiring guides, new features & worker spotlights — every Friday.
                  </p>
                </div>
                <div className="mt-4 flex gap-2 md:mt-0 md:flex-shrink-0">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:focus:border-emerald-400 md:w-52"
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                  >
                    Subscribe
                  </button>
                </div>
              </div>
            </>
          )}

          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10"
            >
              Load more articles ↓
            </button>
          )}
        </div>
      )}
    </div>
  )
}
