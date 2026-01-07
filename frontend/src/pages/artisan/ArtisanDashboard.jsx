import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'

export function ArtisanDashboard() {
  const [jobs, setJobs] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/jobs')
        if (!cancelled) setJobs(Array.isArray(res.data) ? res.data : res.data?.jobs ?? [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load jobs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = jobs.filter((j) => {
    const hay = `${j.title ?? ''} ${j.description ?? ''} ${j.location ?? ''}`.toLowerCase()
    return hay.includes(query.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Artisan Dashboard</h1>
          <p className="text-sm text-slate-600">Browse open jobs and submit quotes.</p>
        </div>
        <div className="w-full md:w-auto">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs…" />
        </div>
      </div>

      <Card>
        <div className="text-sm font-semibold">Jobs</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No jobs found.</div>
        ) : (
          <div className="mt-3 divide-y">
            {filtered.map((j) => (
              <Link key={j.id} to={`/artisan/jobs/${j.id}`} className="block py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{j.title || 'Job'}</div>
                    <div className="text-xs text-slate-600">{j.location || '—'}</div>
                  </div>
                  <Button variant="secondary">View</Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}


