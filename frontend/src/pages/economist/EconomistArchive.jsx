import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { usePageMeta } from '../../components/ui/seo.js'

export function EconomistArchive() {
  usePageMeta({
    title: 'LocalLink Economist • Archive',
    description: 'A monthly digital magazine analysing Ghana’s local labour, trade, produce and SME economy. Browse all issues.',
  })

  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await http.get('/economist')
        if (!cancelled) setIssues(Array.isArray(r.data) ? r.data : [])
      } catch {
        if (!cancelled) setIssues([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <Link to="/news" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          ← Back to News
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-[#111111] dark:text-white md:text-4xl">
          LocalLink Economist
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          A monthly digital magazine analysing Ghana&apos;s local labour, trade, produce and SME economy.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">Loading issues…</div>
      ) : issues.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 py-12 text-center text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          No issues yet. Check back soon.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              to={`/economist/${issue.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-[#b9141a]/30 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-[#b9141a]/40"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {issue.cover_image_url ? (
                  <img
                    src={issue.cover_image_url.startsWith('/') ? issue.cover_image_url : issue.cover_image_url}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl font-serif text-slate-400 dark:text-slate-500">
                    Vol {issue.volume_number}
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2 text-xs font-semibold uppercase tracking-wider text-white">
                  Volume {String(issue.volume_number).padStart(2, '0')} — {issue.issue_date ? new Date(issue.issue_date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : ''}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-serif text-lg font-bold text-slate-900 dark:text-white line-clamp-2">
                  {issue.title}
                </h2>
                {issue.summary ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{issue.summary}</p>
                ) : null}
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#b9141a]">
                  Read Issue →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
