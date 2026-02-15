import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { usePageMeta } from '../../components/ui/seo.js'

function fmtDate(x) {
  try {
    return new Date(x).toLocaleString()
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

function isCtaLine(line) {
  const s = String(line || '').trim()
  if (!s) return false
  return /^cta\s*[:-]/i.test(s) || /^call\s*to\s*action\s*[:-]/i.test(s) || /^next\s*step\s*[:-]/i.test(s)
}

function renderArticleBody(body) {
  const text = String(body || '')
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const out = []

  let paragraph = []
  let list = []

  function flushParagraph() {
    const p = paragraph.join(' ').trim()
    paragraph = []
    if (!p) return
    out.push(
      <p key={`p-${out.length}`} className="mt-3 text-sm leading-relaxed text-slate-800">
        {p}
      </p>,
    )
  }

  function flushList() {
    const items = list
    list = []
    if (!items.length) return
    out.push(
      <ul key={`ul-${out.length}`} className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-800">
        {items.map((x, idx) => (
          <li key={idx}>{x}</li>
        ))}
      </ul>,
    )
  }

  for (const raw of lines) {
    const line = String(raw ?? '')
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      flushParagraph()
      continue
    }

    // Headings: "## Something"
    if (/^##\s+/.test(trimmed)) {
      flushList()
      flushParagraph()
      const h = trimmed.replace(/^##\s+/, '').trim()
      out.push(
        <div key={`h2-${out.length}`} className="mt-6 text-base font-bold text-slate-900">
          {h}
        </div>,
      )
      continue
    }

    // CTA lines: bold + italic
    if (isCtaLine(trimmed)) {
      flushList()
      flushParagraph()
      out.push(
        <div key={`cta-${out.length}`} className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-bold italic text-slate-900">
          {trimmed}
        </div>,
      )
      continue
    }

    // Simple bullets: "- item"
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph()
      list.push(trimmed.replace(/^[-*]\s+/, '').trim())
      continue
    }

    // Default: paragraph (preserve manual line breaks as spaces)
    flushList()
    paragraph.push(trimmed)
  }

  flushList()
  flushParagraph()

  return out.length ? out : <div className="text-sm text-slate-700 whitespace-pre-wrap">{text}</div>
}

export function NewsPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const title = useMemo(() => (post?.title ? `${post.title} • News • LocalLink` : 'News • LocalLink'), [post?.title])
  const desc = useMemo(() => (post?.summary ? String(post.summary).slice(0, 160) : post?.body ? String(post.body).slice(0, 160) : 'LocalLink announcements.'), [post?.summary, post?.body])
  usePageMeta({ title, description: desc })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const r = await http.get(`/news/${encodeURIComponent(slug)}`)
        if (!cancelled) setPost(r.data ?? null)
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load news post')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (slug) load()
    return () => {
      cancelled = true
    }
  }, [slug])

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        kicker="News"
        title={post?.title ?? (loading ? 'Loading…' : 'News post')}
        subtitle={post?.published_at ? `Published: ${fmtDate(post.published_at)}` : ''}
        actions={
          <Link to="/news">
            <Button variant="secondary">All news</Button>
          </Link>
        }
      />

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : !post ? (
        <Card>
          <div className="text-sm text-slate-600">Not found.</div>
        </Card>
      ) : (
        <Card className="p-5">
          {post.hero_image_url ? (
            <figure className="mb-5 overflow-hidden rounded-2xl border bg-slate-50">
              <img
                src={proxiedImage(post.hero_image_url)}
                alt={post.hero_image_alt ?? post.title ?? 'News cover'}
                className="h-64 w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              {post.hero_image_credit ? (
                <figcaption className="border-t bg-white px-4 py-2 text-xs text-slate-500">{post.hero_image_credit}</figcaption>
              ) : null}
            </figure>
          ) : null}
          {post.category ? (
            <div className="mb-3">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{post.category}</span>
            </div>
          ) : null}
          <div className="prose prose-slate max-w-none">
            {renderArticleBody(post.body)}
          </div>
        </Card>
      )}
    </div>
  )
}

