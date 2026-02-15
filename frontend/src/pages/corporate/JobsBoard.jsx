import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'

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

function jobTypeSummary(j) {
  const term = j?.job_term ? String(j.job_term).replaceAll('_', ' ') : ''
  const et = j?.employment_type ? String(j.employment_type).replaceAll('_', ' ') : ''
  const parts = [term, et].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function PromoCard({ imgUrl, title, body, bullets = [] }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="relative h-36 bg-slate-100">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/50" />
      </div>
      <div className="p-5">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-600">{body}</div>
        {bullets.length ? (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {bullets.slice(0, 4).map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  )
}

export function JobsBoard() {
  const [searchParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const company = String(searchParams.get('company') || '').trim()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/corporate/jobs', { params: { limit: 120, company: company || undefined } })
        if (!cancelled) setJobs(Array.isArray(res.data) ? res.data : [])
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load jobs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [company])

  const filtered = useMemo(() => {
    const query = String(q || '').trim().toLowerCase()
    const list = Array.isArray(jobs) ? jobs : []
    if (!query) return list
    return list.filter((j) => {
      const hay = [
        j?.title,
        j?.description,
        j?.location,
        j?.employment_type,
        j?.work_mode,
        j?.company_name,
        ...(Array.isArray(j?.tags) ? j.tags : []),
      ]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
        .join(' ')
      return hay.includes(query)
    })
  }, [jobs, q])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Employers"
        title={company ? 'Jobs at this company' : 'Jobs'}
        subtitle={company ? `Showing roles posted by ${company}.` : 'Browse roles posted by companies. Apply in minutes.'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/corporate">
              <Button variant="secondary">Employers</Button>
            </Link>
            <Link to="/register?role=company">
              <Button>Post a job</Button>
            </Link>
          </div>
        }
      />

      <Card className="p-4">
        <Label>Search</Label>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. warehouse, electrician, driver, Tema…" />
      </Card>

      {loading ? (
        <Card className="p-5">
          <div className="text-sm text-slate-600">Loading…</div>
        </Card>
      ) : error ? (
        <Card className="p-5">
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : filtered.length === 0 ? (
        <div className="space-y-4">
          {Array.isArray(jobs) && jobs.length === 0 ? (
            <>
              <Card className="p-6">
                <div className="text-base font-bold text-slate-900">Be one of the first companies hiring on LocalLink Employers</div>
                <div className="mt-1 text-sm text-slate-700">
                  Create a company page, post roles, and manage applicants cleanly — without WhatsApp chaos.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/register?role=company">
                    <Button>Create company account</Button>
                  </Link>
                  <Link to="/corporate">
                    <Button variant="secondary">How Employers works</Button>
                  </Link>
                </div>
                <div className="mt-2 text-xs text-slate-500">Tip: you can post warehouse, logistics, trades, and operations roles.</div>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                <PromoCard
                  imgUrl="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  title="Post jobs that get serious applicants"
                  body="Clear role details + structured applications makes it easier for the right people to apply."
                  bullets={['Public company page for credibility', 'Fast posting for repeat hiring', 'Applications stay in one place']}
                />
                <PromoCard
                  imgUrl="https://images.pexels.com/photos/3768894/pexels-photo-3768894.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  title="Hire with proof, not promises"
                  body="Applicants build professional identity on LocalLink (history, endorsements, badges)."
                  bullets={['Verified-only reviews', 'Work history timeline', 'Skill endorsements (transaction-backed)']}
                />
                <PromoCard
                  imgUrl="https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=1600"
                  title="Reduce no-shows with accountability"
                  body="Trust & policy rails help you spot risk patterns early and keep hiring reliable."
                  bullets={['Trust scoring signals', 'Dispute support if needed', 'Industry mode (coming soon)']}
                />
              </div>
            </>
          ) : (
            <Card className="p-6">
              <div className="text-sm font-semibold text-slate-900">No jobs match your search.</div>
              <div className="mt-1 text-sm text-slate-600">Try a broader keyword (e.g. “warehouse”, “driver”, “electrician”) or clear your filters.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setQ('')}>
                  Clear search
                </Button>
                <Link to="/register?role=company">
                  <Button>Post a job</Button>
                </Link>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((j) => (
            <Card key={j.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{j.title}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {j.company_name || 'Company'}{j.location ? ` • ${j.location}` : ''}{' '}
                    {j.employment_type ? ` • ${String(j.employment_type).replaceAll('_', ' ')}` : ''}
                    {j.work_mode ? ` • ${j.work_mode}` : ''}
                  </div>
                </div>
                {j.company_logo_url ? (
                  <img src={j.company_logo_url} alt="logo" className="h-10 w-10 rounded-xl border object-cover" />
                ) : null}
              </div>

              {moneyRange(j) ? <div className="mt-2 text-sm font-semibold text-emerald-700">{moneyRange(j)}</div> : null}
              {jobTypeSummary(j) ? <div className="mt-1 text-xs font-semibold text-slate-600">{jobTypeSummary(j)}</div> : null}

              <div className="mt-3 line-clamp-2 text-sm text-slate-700">{j.description}</div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/jobs/${j.id}`}>
                  <Button>View</Button>
                </Link>
                {j.company_slug ? (
                  <Link to={`/c/${j.company_slug}`}>
                    <Button variant="secondary">Company</Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

