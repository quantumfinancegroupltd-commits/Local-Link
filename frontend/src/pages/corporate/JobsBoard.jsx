import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { BrowseLayout } from '../../components/layout/BrowseLayout.jsx'
import { BrowseMap } from '../../components/maps/BrowseMap.jsx'
import { coordsFromLocationText, spreadDuplicatePins } from '../../lib/geo.js'

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

const jobCardDefaults = {
  retail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=240&fit=crop&q=70',
  supervisor: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70',
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=240&fit=crop&q=70',
  default: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=240&fit=crop&q=70',
}
function getDefaultJobImage(job) {
  const t = String((job?.title || '') + ' ' + (job?.employment_type || '')).toLowerCase()
  if (/\b(retail|store|sales|associate|shop)\b/.test(t)) return jobCardDefaults.retail
  if (/\b(warehouse|packer|packing|logistics|inventory)\b/.test(t)) return jobCardDefaults.warehouse
  if (/\b(supervisor|manager|operations|team lead)\b/.test(t)) return jobCardDefaults.supervisor
  if (/\b(office|admin|coordinator)\b/.test(t)) return jobCardDefaults.office
  return jobCardDefaults.default
}

const EMPLOYMENT_OPTIONS = [
  { value: '', label: 'Any type' },
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'shift', label: 'Shift' },
  { value: 'internship', label: 'Internship' },
]
const WORK_MODE_OPTIONS = [
  { value: '', label: 'Any mode' },
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]
const JOB_TERM_OPTIONS = [
  { value: '', label: 'Any term' },
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
]

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

const FILTER_KEYS = ['q', 'location', 'employment_type', 'work_mode', 'job_term', 'pay_min', 'pay_max']

export function JobsBoard() {
  const { isAuthed } = useAuth()
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const company = String(searchParams.get('company') || '').trim()
  const [alertBusy, setAlertBusy] = useState(false)

  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [location, setLocation] = useState(() => searchParams.get('location') ?? '')
  const [employmentType, setEmploymentType] = useState(() => searchParams.get('employment_type') ?? '')
  const [workMode, setWorkMode] = useState(() => searchParams.get('work_mode') ?? '')
  const [jobTerm, setJobTerm] = useState(() => searchParams.get('job_term') ?? '')
  const [payMin, setPayMin] = useState(() => searchParams.get('pay_min') ?? '')
  const [payMax, setPayMax] = useState(() => searchParams.get('pay_max') ?? '')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Sync filter state from URL when user navigates (back/forward)
  const prevParamsRef = useRef(searchParams.toString())
  useEffect(() => {
    const current = searchParams.toString()
    if (current === prevParamsRef.current) return
    prevParamsRef.current = current
    setQ(searchParams.get('q') ?? '')
    setLocation(searchParams.get('location') ?? '')
    setEmploymentType(searchParams.get('employment_type') ?? '')
    setWorkMode(searchParams.get('work_mode') ?? '')
    setJobTerm(searchParams.get('job_term') ?? '')
    setPayMin(searchParams.get('pay_min') ?? '')
    setPayMax(searchParams.get('pay_max') ?? '')
  }, [searchParams])

  function updateUrlFilters(updates) {
    const next = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((key) => {
      const v = updates[key] !== undefined ? updates[key] : (key === 'q' ? q : key === 'location' ? location : key === 'employment_type' ? employmentType : key === 'work_mode' ? workMode : key === 'job_term' ? jobTerm : key === 'pay_min' ? payMin : payMax)
      if (v != null && String(v).trim() !== '') next.set(key, String(v).trim())
      else next.delete(key)
    })
    prevParamsRef.current = next.toString()
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/corporate/jobs', { params: { limit: 200, company: company || undefined } })
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

  const locations = useMemo(() => {
    const set = new Set()
    for (const j of jobs) {
      const loc = j?.location ?? j?.company_location
      if (typeof loc === 'string' && loc.trim()) set.add(loc.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [jobs])

  const filtered = useMemo(() => {
    const query = String(q || '').trim().toLowerCase()
    const list = Array.isArray(jobs) ? jobs : []
    return list.filter((j) => {
      if (query) {
        const hay = [
          j?.title,
          j?.description,
          j?.location,
          j?.employment_type,
          j?.work_mode,
          j?.company_name,
          j?.company_location,
          ...(Array.isArray(j?.tags) ? j.tags : []),
        ]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase())
          .join(' ')
        if (!hay.includes(query)) return false
      }
      if (location && String(j?.location ?? j?.company_location ?? '').trim() !== location) return false
      if (employmentType && String(j?.employment_type ?? '') !== employmentType) return false
      if (workMode && String(j?.work_mode ?? '') !== workMode) return false
      if (jobTerm && String(j?.job_term ?? '') !== jobTerm) return false
      const minP = payMin !== '' ? Number(payMin) : null
      const maxP = payMax !== '' ? Number(payMax) : null
      const jobMin = j?.pay_min != null ? Number(j.pay_min) : null
      const jobMax = j?.pay_max != null ? Number(j.pay_max) : null
      if (minP != null && !Number.isNaN(minP) && (jobMax ?? 1e9) < minP) return false
      if (maxP != null && !Number.isNaN(maxP) && (jobMin ?? 0) > maxP) return false
      return true
    })
  }, [jobs, q, location, employmentType, workMode, jobTerm, payMin, payMax])

  const hasActiveFilters = q || location || employmentType || workMode || jobTerm || payMin || payMax

  function clearFilters() {
    setQ('')
    setLocation('')
    setEmploymentType('')
    setWorkMode('')
    setJobTerm('')
    setPayMin('')
    setPayMax('')
    const next = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((k) => next.delete(k))
    prevParamsRef.current = next.toString()
    setSearchParams(next, { replace: true })
  }

  const jobMapPins = useMemo(() => {
    const pins = (filtered || [])
      .map((j) => {
        const rawLat = j?.location_lat ?? j?.locationLat ?? null
        const rawLng = j?.location_lng ?? j?.locationLng ?? null
        let lat = rawLat != null ? Number(rawLat) : NaN
        let lng = rawLng != null ? Number(rawLng) : NaN
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          const fallback = coordsFromLocationText(j?.location ?? j?.company_location ?? '')
          if (fallback) {
            lat = fallback.lat
            lng = fallback.lng
          }
        }
        if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
        return { j, lat, lng }
      })
      .filter(Boolean)
      .map(({ j, lat, lng }) => {
        const loc = j?.location ?? j?.company_location ?? ''
        const imgUrl = j?.image_url || j?.company_logo_url || null
        const payLabel = moneyRange(j) || undefined
        return {
          id: j.id,
          lat,
          lng,
          title: j?.title ?? 'Job',
          subtitle: String(loc).trim() || undefined,
          href: `/jobs/${j.id}`,
          imageUrl: imgUrl ?? undefined,
          priceLabel: payLabel,
        }
      })
    return spreadDuplicatePins(pins)
  }, [filtered])

  const mapCard = (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Map</h2>
      <BrowseMap
        pins={jobMapPins}
        defaultZoom={jobMapPins.length > 0 ? undefined : 6}
        emptyMessage="Jobs with a set location will show as pins. Companies can add location when posting a job."
      />
    </div>
  )

  const filtersSidebar = (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-slate-800 dark:text-white">Filters</div>
      <div>
        <Label className="text-xs">Keyword</Label>
        <Input
          value={q}
          onChange={(e) => {
            const v = e.target.value
            setQ(v)
            updateUrlFilters({ q: v })
          }}
          placeholder="e.g. warehouse, driver, Tema"
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Location</Label>
        <Select value={location} onChange={(e) => { const v = e.target.value; setLocation(v); updateUrlFilters({ location: v }) }} className="mt-1">
          <option value="">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label className="text-xs">Job type</Label>
        <Select value={employmentType} onChange={(e) => { const v = e.target.value; setEmploymentType(v); updateUrlFilters({ employment_type: v }) }} className="mt-1">
          {EMPLOYMENT_OPTIONS.map((o) => (
            <option key={o.value || 'any'} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label className="text-xs">Work mode</Label>
        <Select value={workMode} onChange={(e) => { const v = e.target.value; setWorkMode(v); updateUrlFilters({ work_mode: v }) }} className="mt-1">
          {WORK_MODE_OPTIONS.map((o) => (
            <option key={o.value || 'any'} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label className="text-xs">Job term</Label>
        <Select value={jobTerm} onChange={(e) => { const v = e.target.value; setJobTerm(v); updateUrlFilters({ job_term: v }) }} className="mt-1">
          {JOB_TERM_OPTIONS.map((o) => (
            <option key={o.value || 'any'} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Salary min (GHS)</Label>
          <Input
            type="number"
            min={0}
            value={payMin}
            onChange={(e) => { const v = e.target.value; setPayMin(v); updateUrlFilters({ pay_min: v }) }}
            placeholder="Min"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Salary max (GHS)</Label>
          <Input
            type="number"
            min={0}
            value={payMax}
            onChange={(e) => { const v = e.target.value; setPayMax(v); updateUrlFilters({ pay_max: v }) }}
            placeholder="Max"
            className="mt-1"
          />
        </div>
      </div>
      {hasActiveFilters ? (
        <Button variant="secondary" className="w-full" onClick={clearFilters}>
          Clear all filters
        </Button>
      ) : null}
    </div>
  )

  return (
    <BrowseLayout sidebar={filtersSidebar} sidebarBottom={mapCard}>
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

      {!loading && !error && jobs.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>{filtered.length} job{filtered.length === 1 ? '' : 's'} found</span>
          {isAuthed ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={alertBusy}
              onClick={async () => {
                setAlertBusy(true)
                try {
                  await http.post('/corporate/job-alerts', {
                    q: q || null,
                    location: location || null,
                    employment_type: employmentType || null,
                    work_mode: workMode || null,
                  })
                  toast.success('Job alert saved. We’ll notify you when new jobs match.')
                } catch (e) {
                  toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save alert')
                } finally {
                  setAlertBusy(false)
                }
              }}
            >
              {alertBusy ? 'Saving…' : 'Notify me when jobs match'}
            </Button>
          ) : (
            <Link to={`/login?next=${encodeURIComponent('/jobs')}`} className="text-emerald-700 hover:underline">
              Sign in to get job alerts
            </Link>
          )}
        </div>
      ) : null}

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
              <div className="text-sm font-semibold text-slate-900">No jobs match your filters.</div>
              <div className="mt-1 text-sm text-slate-600">Try broadening keyword, location, or salary range — or clear all filters.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear all filters
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
          {filtered.map((j) => {
            const jobImgSrc = j.image_url
              ? (j.image_url.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${j.image_url}` : j.image_url)
              : getDefaultJobImage(j)
            return (
              <Card key={j.id} className="p-0 overflow-hidden">
                <div className="relative h-40 w-full bg-slate-100">
                  <img
                    src={jobImgSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
                <div className="p-5">
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
                      <img src={j.company_logo_url} alt="logo" className="h-10 w-10 rounded-xl border object-cover flex-shrink-0" />
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
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </BrowseLayout>
  )
}
