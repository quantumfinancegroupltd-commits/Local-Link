import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

function moneyRange(j) {
  const min = j?.pay_min != null ? Number(j.pay_min) : null
  const max = j?.pay_max != null ? Number(j.pay_max) : null
  const c = j?.currency || 'GHS'
  const per = String(j?.pay_period || '').trim().toLowerCase()
  const suffix = per ? ` / ${per}` : ''
  if (min == null && max == null) return null
  if (min != null && max != null) return `${c} ${min.toFixed(0)}–${max.toFixed(0)}${suffix}`
  if (min != null) return `${c} ${min.toFixed(0)}+${suffix}`
  return `${c} up to ${max.toFixed(0)}${suffix}`
}

function humanJobType(j) {
  const term = j?.job_term ? String(j.job_term).replaceAll('_', ' ') : null
  const et = j?.employment_type ? String(j.employment_type).replaceAll('_', ' ') : null
  const parts = [term, et].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function JobDetail() {
  const { id } = useParams()
  const { isAuthed, user } = useAuth()
  const toast = useToast()

  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [fullName, setFullName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [cover, setCover] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const canApply = useMemo(() => isAuthed && user?.role !== 'company' && user?.role !== 'admin', [isAuthed, user?.role])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get(`/corporate/jobs/${encodeURIComponent(id)}`)
        if (!cancelled) setJob(res.data ?? null)
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Job not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function apply() {
    setBusy(true)
    try {
      await http.post(`/corporate/jobs/${encodeURIComponent(id)}/apply`, {
        full_name: fullName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        cover_letter: cover,
      })
      setSubmitted(true)
      toast.success('Application submitted.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to apply')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>Loading…</Card>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card className="p-5">
          <div className="text-sm text-red-700">{error || 'Job not found'}</div>
          <div className="mt-3">
            <Link to="/jobs">
              <Button variant="secondary">Back to jobs</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker="Job"
        title={job.title}
        subtitle={job.company_name || 'Company'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/jobs">
              <Button variant="secondary">All jobs</Button>
            </Link>
            {job.company_slug ? (
              <Link to={`/c/${job.company_slug}`}>
                <Button variant="secondary">Company page</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              {job.company_logo_url ? <img src={job.company_logo_url} alt="logo" className="h-12 w-12 rounded-2xl border object-cover" /> : null}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{job.company_name || 'Company'}</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {job.location || job.company_location || ''}
                  {job.work_mode ? ` • ${job.work_mode}` : ''}
                </div>
              </div>
            </div>

            {moneyRange(job) ? <div className="mt-3 text-base font-bold text-emerald-700">{moneyRange(job)}</div> : null}
            {humanJobType(job) ? <div className="mt-1 text-sm font-semibold text-slate-700">{humanJobType(job)}</div> : null}
            {job.schedule_text ? <div className="mt-1 text-sm text-slate-700">{job.schedule_text}</div> : null}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold text-slate-900">Job details</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-slate-700">Pay</div>
            <div className="mt-1 text-sm text-slate-800">{moneyRange(job) || 'Not specified'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">Job type</div>
            <div className="mt-1 text-sm text-slate-800">{humanJobType(job) || 'Not specified'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">Shift and schedule</div>
            <div className="mt-1 text-sm text-slate-800">{job.schedule_text || 'Not specified'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700">Location</div>
            <div className="mt-1 text-sm text-slate-800">{job.location || job.company_location || 'Not specified'}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs font-semibold text-slate-700">Benefits</div>
            {Array.isArray(job.benefits) && job.benefits.length ? (
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {job.benefits.slice(0, 12).map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-slate-800">
                    <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-sm text-slate-800">Not specified</div>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold text-slate-900">Full job description</div>
        <div className="mt-4 whitespace-pre-wrap text-sm text-slate-800">{job.description}</div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold">Apply</div>
        {!isAuthed ? (
          <div className="mt-2 text-sm text-slate-700">
            Please <Link className="font-semibold text-emerald-700 hover:underline" to={`/login`}>login</Link> to apply.
          </div>
        ) : user?.role === 'company' ? (
          <div className="mt-2 text-sm text-slate-700">Company accounts can’t apply to jobs.</div>
        ) : user?.role === 'admin' ? (
          <div className="mt-2 text-sm text-slate-700">Admin accounts can’t apply to jobs.</div>
        ) : submitted ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Application submitted.</div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/messages/jobpost/${id}`}>
                <Button>Open chat with company</Button>
              </Link>
              <Link to="/messages">
                <Button variant="secondary">My messages</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-1">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="md:col-span-1">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div className="md:col-span-1">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233…" />
              </div>
            </div>
            <div>
              <Label>Cover letter</Label>
              <textarea
                className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                rows={6}
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="Tell the company why you’re a great fit…"
              />
            </div>
            <Button onClick={apply} disabled={busy || !canApply || !cover.trim()}>
              {busy ? 'Submitting…' : 'Submit application'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

