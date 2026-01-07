import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function BuyerJobs() {
  const [jobs, setJobs] = useState([])
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Jobs</h1>
          <p className="text-sm text-slate-600">Track your jobs and review artisan quotes.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/buyer/jobs/new">
            <Button>Post a Job</Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="secondary">Browse Produce</Button>
          </Link>
        </div>
      </div>

      <Card>
        <div className="text-sm font-semibold">My Jobs</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : jobs.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No jobs yet. Post your first job to get quotes.</div>
        ) : (
          <div className="mt-3 divide-y">
            {jobs.map((j) => (
              <Link key={j.id} to={`/buyer/jobs/${j.id}`} className="block py-3 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{j.title || 'Job'}</div>
                    <div className="text-xs text-slate-600">{j.location || '—'}</div>
                  </div>
                  <div className="text-xs font-medium text-slate-700">{j.status || 'open'}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}


