import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Select } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

export function BuyerJobs() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleteBusyId, setDeleteBusyId] = useState(null)
  const [tab, setTab] = useState('active') // active | open | assigned | in_progress | completed | cancelled | all
  const [query, setQuery] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

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

  useEffect(() => {
    const nextTab = String(searchParams.get('tab') || '').trim()
    const nextQ = String(searchParams.get('q') || '')
    const allowed = new Set(['active', 'open', 'assigned', 'in_progress', 'completed', 'cancelled', 'all'])
    if (nextTab && allowed.has(nextTab) && nextTab !== tab) setTab(nextTab)
    if (nextQ !== query) setQuery(nextQ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const t0 = String(tab || '').trim()
      const q0 = String(query || '').trim()
      if (t0) next.set('tab', t0)
      else next.delete('tab')
      if (q0) next.set('q', q0)
      else next.delete('q')
      if (String(next.toString()) !== String(searchParams.toString())) setSearchParams(next, { replace: true })
    }, 250)
    return () => clearTimeout(t)
  }, [tab, query, searchParams, setSearchParams])

  const counts = useMemo(() => {
    const c = { all: jobs.length, active: 0, open: 0, assigned: 0, in_progress: 0, completed: 0, cancelled: 0 }
    for (const j of jobs) {
      const s = String(j?.status ?? 'open')
      if (s in c) c[s] += 1
      if (s !== 'cancelled') c.active += 1
    }
    return c
  }, [jobs])

  const filtered = useMemo(() => {
    const q = String(query || '').trim().toLowerCase()
    return jobs.filter((j) => {
      const s = String(j?.status ?? 'open')
      const matchTab =
        tab === 'all'
          ? true
          : tab === 'active'
            ? s !== 'cancelled'
            : s === tab
      if (!matchTab) return false
      if (!q) return true
      const hay = `${j?.title ?? ''} ${j?.location ?? ''} ${j?.status ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [jobs, tab, query])

  function csvCell(v) {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }

  async function copyCurrentLink() {
    const href = window.location?.href ? String(window.location.href) : ''
    if (!href) return toast.error('Copy failed', 'Missing URL')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(href)
        toast.success('Link copied.')
        return
      }
      window.prompt('Copy this link', href)
    } catch (e) {
      toast.error('Copy failed', e?.message ?? 'Unable to copy link')
    }
  }

  async function exportCsv() {
    if (exportBusy) return
    setExportBusy(true)
    try {
      const rows = Array.isArray(filtered) ? filtered : []
      if (!rows.length) return toast.warning('Nothing to export', 'No jobs match the current filter.')
      const header = ['job_id', 'title', 'status', 'location', 'created_at', 'updated_at']
      const lines = [header.join(',')]
      for (const j of rows) {
        lines.push([csvCell(j?.id), csvCell(j?.title), csvCell(j?.status), csvCell(j?.location), csvCell(j?.created_at), csvCell(j?.updated_at)].join(','))
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `buyer_jobs_${String(tab || 'all')}_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Exported CSV.')
    } catch (e) {
      toast.error('Export failed', e?.message ?? 'Unable to export CSV')
    } finally {
      setExportBusy(false)
    }
  }

  async function deleteJob(jobId) {
    const ok = window.confirm(
      'Delete this job? This removes it from your list.\n\nYou can only delete jobs that are not in progress (e.g. open, cancelled, or completed).',
    )
    if (!ok) return
    setDeleteBusyId(jobId)
    setError(null)
    try {
      await http.delete(`/jobs/${jobId}`)
      const res = await http.get('/jobs')
      setJobs(Array.isArray(res.data) ? res.data : res.data?.jobs ?? [])
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to delete job')
    } finally {
      setDeleteBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Jobs"
        subtitle="Track your jobs and review artisan quotes."
        actions={
          <>
            <Link to="/buyer/jobs/new">
              <Button>Post a job</Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="secondary">Browse produce</Button>
            </Link>
            <Button variant="secondary" onClick={() => copyCurrentLink().catch(() => {})}>
              Copy link
            </Button>
            <Button variant="secondary" disabled={exportBusy} onClick={() => exportCsv().catch(() => {})}>
              {exportBusy ? 'Exporting…' : 'Export CSV'}
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div className="text-xs font-semibold text-slate-700">Search</div>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="kitchen, plumbing, Accra…" />
          </div>
          <div className="md:col-span-3">
            <div className="text-xs font-semibold text-slate-700">Status</div>
            <Select value={tab} onChange={(e) => setTab(e.target.value)}>
              <option value="active">Active ({counts.active})</option>
              <option value="open">Open ({counts.open})</option>
              <option value="assigned">Assigned ({counts.assigned})</option>
              <option value="in_progress">In progress ({counts.in_progress})</option>
              <option value="completed">Completed ({counts.completed})</option>
              <option value="cancelled">Cancelled ({counts.cancelled})</option>
              <option value="all">All ({counts.all})</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button
              variant="secondary"
              onClick={() => {
                setTab('active')
                setQuery('')
              }}
            >
              Clear
            </Button>
          </div>
          <div className="md:col-span-12 text-xs text-slate-500">
            Showing {filtered.length}/{jobs.length || 0}
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <div className="text-sm text-slate-600">Loading…</div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Post your first job to receive quotes from trusted artisans."
          actions={
            <Link to="/buyer/jobs/new">
              <Button>Post your first job</Button>
            </Link>
          }
        />
      ) : (
        <Card className="p-0">
          <div className="divide-y">
            {filtered.map((j) => (
              <div key={j.id} className="px-5 py-3 hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link to={`/buyer/jobs/${j.id}`} className="min-w-0">
                    <div className="truncate text-sm font-semibold">{j.title || 'Job'}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-600">{j.location || '—'}</div>
                  </Link>
                  <div className="flex items-center gap-2">
                    <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {j.status || 'open'}
                    </div>
                    {['open', 'cancelled', 'completed'].includes(j.status) ? (
                      <Button
                        variant="secondary"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        disabled={deleteBusyId === j.id}
                        onClick={() => deleteJob(j.id)}
                      >
                        {deleteBusyId === j.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}


