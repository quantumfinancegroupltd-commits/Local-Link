import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { StatusTimeline } from '../../components/ui/StatusTimeline.jsx'
import { buildJobTimeline } from '../../lib/statusTimelines.js'
import { WhatHappensIfModal } from '../../components/trust/WhatHappensIfModal.jsx'
import { StickyActionBar } from '../../components/ui/StickyActionBar.jsx'
import { TrustBadge } from '../../components/ui/TrustBadge.jsx'
import { VerificationBadge } from '../../components/ui/VerificationBadge.jsx'

function ReviewCta({ jobId }) {
  const [loading, setLoading] = useState(true)
  const [eligibility, setEligibility] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadEligibility() {
      setLoading(true)
      try {
        const r = await http.get(`/reviews/jobs/${encodeURIComponent(jobId)}/eligibility`)
        if (!cancelled) setEligibility(r.data ?? null)
      } catch {
        if (!cancelled) setEligibility(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (jobId) loadEligibility()
    return () => {
      cancelled = true
    }
  }, [jobId])

  if (loading) {
    return (
      <Button variant="secondary" disabled title="Checking…">
        Rate artisan
      </Button>
    )
  }

  if (!eligibility) {
    return (
      <Link to={`/reviews/leave?kind=job&id=${encodeURIComponent(jobId)}`}>
        <Button variant="secondary">Rate artisan</Button>
      </Link>
    )
  }

  if (eligibility?.already_reviewed) {
    return (
      <Button variant="secondary" disabled title="Already reviewed">
        Reviewed
      </Button>
    )
  }

  if (eligibility?.eligible === false) {
    return (
      <Button variant="secondary" disabled title={eligibility?.reason ?? 'Not available'}>
        Rate artisan
      </Button>
    )
  }

  return (
    <Link to={`/reviews/leave?kind=job&id=${encodeURIComponent(jobId)}`}>
      <Button variant="secondary">Rate artisan</Button>
    </Link>
  )
}

export function BuyerJobDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [selectedQuoteId, setSelectedQuoteId] = useState(null)
  const [quotesViewMode, setQuotesViewMode] = useState('compare') // 'table' | 'compare'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyQuoteId, setBusyQuoteId] = useState(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [info, setInfo] = useState(null)
  const [escrowStatus, setEscrowStatus] = useState(null)
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const [noShowOpen, setNoShowOpen] = useState(false)
  const [noShowDetails, setNoShowDetails] = useState('')
  const [noShowFiles, setNoShowFiles] = useState([])
  const [noShowBusy, setNoShowBusy] = useState(false)
  const [noShowError, setNoShowError] = useState(null)
  const [noShowOk, setNoShowOk] = useState(null)
  const [proofs, setProofs] = useState([])
  const [proofsLoading, setProofsLoading] = useState(false)
  const [proofsError, setProofsError] = useState(null)
  const [shareToFeedBusy, setShareToFeedBusy] = useState(false)
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setInfo(null)
      try {
        const [jobRes, quotesRes, escrowRes] = await Promise.all([
          http.get(`/jobs/${id}`),
          http.get(`/jobs/${id}/quotes`).catch(() => ({ data: [] })),
          http.get(`/escrow/jobs/${id}`).catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setJob(jobRes.data?.job ?? jobRes.data ?? null)
        setQuotes(Array.isArray(quotesRes.data) ? quotesRes.data : quotesRes.data?.quotes ?? [])
        const tx = Array.isArray(escrowRes.data) ? escrowRes.data : []
        setEscrowStatus(tx?.[0]?.status ?? 'not_started')
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load job')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function loadProof() {
      setProofsLoading(true)
      setProofsError(null)
      try {
        const r = await http.get(`/jobs/${encodeURIComponent(id)}/proofs`)
        if (cancelled) return
        setProofs(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        if (cancelled) return
        setProofsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load work proof')
        setProofs([])
      } finally {
        if (!cancelled) setProofsLoading(false)
      }
    }
    if (id) loadProof().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  const timeline = useMemo(() => {
    return buildJobTimeline(job?.status ?? 'open', escrowStatus ?? 'not_started')
  }, [job?.status, escrowStatus])

  const nextStep = useMemo(() => {
    if (!job) return null
    const status = job.status || 'open'
    const accepted = Number(job?.accepted_quote ?? job?.acceptedQuote ?? 0)
    const esc = String(escrowStatus ?? 'not_started')

    if (status === 'open' && !accepted) {
      if (!quotes.length) {
        return {
          variant: 'info',
          title: 'Next: wait for quotes',
          description: 'Tip: clear photos/videos and a specific location gets faster responses.',
          actions: (
            <>
              <Link to={`/buyer/jobs/${id}/escrow`}>
                <Button variant="secondary">How escrow works</Button>
              </Link>
            </>
          ),
        }
      }
      return {
        variant: 'info',
        title: 'Next: compare quotes and accept one',
        description: 'Choose a provider you trust. After accepting, fund escrow to protect both sides.',
        actions: (
          <Button
            variant="secondary"
            onClick={() => document.getElementById('quotes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            View quotes
          </Button>
        ),
      }
    }

    if (accepted && ['not_started', 'created', 'pending_payment', 'cancelled', 'failed', 'refunded'].includes(esc)) {
      return {
        variant: 'success',
        title: 'Next: fund your escrow deposit',
        description: 'This locks the job in and prevents payment disputes later.',
        actions: (
          <Link to={`/buyer/jobs/${id}/escrow`}>
            <Button>Open Trust Wallet</Button>
          </Link>
        ),
      }
    }

    if (status === 'completed' && esc === 'completed_pending_confirmation') {
      return {
        variant: 'warning',
        title: 'Next: confirm completion (or open a dispute)',
        description: 'If the work is done, release funds. If not, open a dispute to freeze escrow for review.',
        actions: (
          <Link to={`/buyer/jobs/${id}/escrow`}>
            <Button>Review in Trust Wallet</Button>
          </Link>
        ),
      }
    }

    if (status === 'completed' && esc === 'released') {
      return {
        variant: 'success',
        title: 'Next: leave a review',
        description: 'Ratings build trust and improve future matches.',
        actions: (
          <ReviewCta jobId={id} />
        ),
      }
    }

    return null
  }, [job, escrowStatus, quotes.length, id])

  async function acceptQuote(quoteId) {
    setBusyQuoteId(quoteId)
    setInfo(null)
    try {
      await http.put(`/quotes/${quoteId}`, { status: 'accepted' })
      const [jobRes, quotesRes, escrowRes] = await Promise.all([
        http.get(`/jobs/${id}`),
        http.get(`/jobs/${id}/quotes`),
        http.get(`/escrow/jobs/${id}`).catch(() => ({ data: [] })),
      ])
      setJob(jobRes.data?.job ?? jobRes.data ?? null)
      setQuotes(Array.isArray(quotesRes.data) ? quotesRes.data : quotesRes.data?.quotes ?? [])
      const tx = Array.isArray(escrowRes.data) ? escrowRes.data : []
      setEscrowStatus(tx?.[0]?.status ?? 'not_started')
      setInfo('Quote accepted. Next step: fund escrow deposit to protect both sides.')
    } finally {
      setBusyQuoteId(null)
    }
  }

  async function cancelJob() {
    const ok = window.confirm('Cancel this job? If escrow is held, it will be refunded unless there is an active dispute.')
    if (!ok) return
    setCancelBusy(true)
    setError(null)
    setInfo(null)
    try {
      await http.post(`/jobs/${id}/cancel`)
      const jobRes = await http.get(`/jobs/${id}`)
      setJob(jobRes.data?.job ?? jobRes.data ?? null)
      setInfo('Job cancelled.')
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to cancel job')
    } finally {
      setCancelBusy(false)
    }
  }

  async function deleteJob() {
    const ok = window.confirm(
      'Delete this job? This removes it from your list.\n\nYou can only delete jobs that are not in progress (e.g. open, cancelled, or completed).',
    )
    if (!ok) return
    setDeleteBusy(true)
    setError(null)
    setInfo(null)
    try {
      await http.delete(`/jobs/${id}`)
      navigate('/buyer/jobs', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to delete job')
    } finally {
      setDeleteBusy(false)
    }
  }

  async function submitNoShow() {
    setNoShowBusy(true)
    setNoShowError(null)
    setNoShowOk(null)
    try {
      const urls = noShowFiles.length ? (await uploadMediaFiles(noShowFiles)).map((x) => x.url).filter(Boolean) : []
      const subject = `No-show report: ${String(job?.title || 'Job')}`
      const description =
        `Job ID: ${String(id)}\n\n` +
        `Problem: Provider did not show up / is not responding.\n\n` +
        (noShowDetails.trim() ? `Details:\n${noShowDetails.trim()}\n\n` : '') +
        `Please review and advise.`
      await http.post('/support/tickets', {
        category: 'jobs',
        subject,
        description,
        related_type: 'job',
        related_id: String(id),
        attachments: urls.length ? urls : null,
      })
      setNoShowOk('Report sent to Support. An admin will review and can enforce reliability penalties if confirmed.')
      setNoShowFiles([])
      setNoShowDetails('')
    } catch (e) {
      setNoShowError(e?.response?.data?.message ?? e?.message ?? 'Failed to submit report')
    } finally {
      setNoShowBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <WhatHappensIfModal open={whatIfOpen} onClose={() => setWhatIfOpen(false)} context="job" />
      {noShowOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl border bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-900">Report no-show</div>
                <div className="mt-1 text-sm text-slate-600">
                  Add details and optional evidence. Support will review and can enforce reliability penalties if confirmed.
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setNoShowOpen(false)
                  setNoShowError(null)
                  setNoShowOk(null)
                }}
              >
                Close
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Details (optional)</div>
                <textarea
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  rows={4}
                  value={noShowDetails}
                  onChange={(e) => setNoShowDetails(e.target.value)}
                  placeholder="When was the appointment? What happened? Any calls/messages?"
                  disabled={noShowBusy}
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Evidence (optional)</div>
                <input
                  className="mt-2 block w-full text-sm"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => setNoShowFiles(Array.from(e.target.files ?? []))}
                  disabled={noShowBusy}
                />
                {noShowFiles.length ? <div className="mt-1 text-xs text-slate-600">{noShowFiles.length} file(s) selected</div> : null}
                <div className="mt-1 text-xs text-slate-500">Max 50MB per file.</div>
              </div>

              {noShowError ? <div className="text-sm text-red-700">{noShowError}</div> : null}
              {noShowOk ? <div className="text-sm text-emerald-700">{noShowOk}</div> : null}

              <div className="flex flex-wrap gap-2">
                <Button disabled={noShowBusy} onClick={submitNoShow}>
                  {noShowBusy ? 'Submitting…' : 'Submit report'}
                </Button>
                <Link to="/support" onClick={() => setNoShowOpen(false)}>
                  <Button variant="secondary" type="button">
                    Open Support
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <EmptyState
          title="Job not available"
          description={error}
          actions={
            <Link to="/buyer/jobs">
              <Button variant="secondary">Back to jobs</Button>
            </Link>
          }
        />
      ) : (
        <>
          <PageHeader
            kicker="Job"
            title={job?.title || 'Job'}
            subtitle={
              [
                job?.location || null,
                job?.scheduled_at ? `Scheduled: ${new Date(job.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : null,
                job?.recurring_frequency ? `Recurring: ${job.recurring_frequency}${job?.recurring_end_date ? ` until ${new Date(job.recurring_end_date).toLocaleDateString()}` : ''}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'
            }
            actions={
              <>
                <StatusPill status={job?.status || 'open'} />
                <Link to="/buyer/jobs">
                  <Button variant="secondary">Back</Button>
                </Link>
                {['open', 'cancelled', 'completed'].includes(job?.status) ? (
                  <Button
                    variant="secondary"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    disabled={deleteBusy}
                    onClick={deleteJob}
                  >
                    {deleteBusy ? 'Deleting…' : 'Delete job'}
                  </Button>
                ) : null}
              </>
            }
          />

          {info ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <div className="text-sm font-semibold text-emerald-900">{info}</div>
            </Card>
          ) : null}

          <Card>
            <div className="text-sm font-semibold">Progress</div>
            <div className="mt-4">
              <StatusTimeline steps={timeline.steps} />
            </div>
            {nextStep ? (
              <NextStepBanner
                className="mt-4"
                variant={nextStep.variant}
                title={nextStep.title}
                description={nextStep.description}
                actions={nextStep.actions}
              />
            ) : timeline.banner ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {timeline.banner}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="flex flex-wrap gap-2">
              {user && id ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={shareToFeedBusy}
                  onClick={async () => {
                    setShareToFeedBusy(true)
                    try {
                      await http.post('/posts', {
                        body: '',
                        type: 'job',
                        related_type: 'job',
                        related_id: id,
                      })
                      toast.success('Shared to feed')
                      navigate('/feed')
                    } catch (e) {
                      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to share')
                    } finally {
                      setShareToFeedBusy(false)
                    }
                  }}
                >
                  {shareToFeedBusy ? 'Sharing…' : 'Share to feed'}
                </Button>
              ) : null}
              {job?.assigned_artisan_id ? (
                <Link to={`/messages/job/${id}`}>
                  <Button variant="secondary">Message artisan</Button>
                </Link>
              ) : null}
              {job?.assigned_artisan_id && ['assigned', 'in_progress'].includes(job?.status) ? (
                <Button
                  variant="secondary"
                  className="border-amber-200 text-amber-900 hover:bg-amber-50"
                  onClick={() => setNoShowOpen(true)}
                >
                  Report no-show
                </Button>
              ) : null}
              <Link to={`/buyer/jobs/${id}/escrow`}>
                <Button variant="secondary">Trust Wallet (escrow)</Button>
              </Link>
              {job?.status !== 'cancelled' && job?.status !== 'completed' ? (
                <Button variant="secondary" disabled={cancelBusy} onClick={cancelJob}>
                  {cancelBusy ? 'Cancelling…' : 'Cancel job'}
                </Button>
              ) : null}
              {['open', 'cancelled', 'completed'].includes(job?.status) ? (
                <Button
                  variant="secondary"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={deleteBusy}
                  onClick={deleteJob}
                >
                  {deleteBusy ? 'Deleting…' : 'Delete job'}
                </Button>
              ) : null}
              {job?.status === 'completed' ? (
                <Link to={`/buyer/jobs/new?rebook=${encodeURIComponent(job.id)}`}>
                  <Button variant="secondary">Rebook</Button>
                </Link>
              ) : null}
            </div>

            {job?.location_lat != null && job?.location_lng != null ? (
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <iframe
                  title="Job location"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(`${job.location_lat},${job.location_lng}`)}&output=embed`}
                  className="h-56 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : job?.location ? (
              <div className="mt-4 overflow-hidden rounded-2xl border">
                <iframe
                  title="Job location"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(job.location)}&output=embed`}
                  className="h-56 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}
            {Array.isArray(job?.media) && job.media.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {job.media.slice(0, 8).map((m) => (
                  <div key={m.url} className="overflow-hidden rounded-2xl border bg-white">
                    {m.kind === 'video' ? (
                      <video src={m.url} controls className="h-56 w-full object-cover" />
                    ) : (
                      <img src={m.url} alt="Job media" className="h-56 w-full object-cover" loading="lazy" />
                    )}
                  </div>
                ))}
              </div>
            ) : job?.image_url ? (
              <div className="mt-4">
                <img
                  src={job.image_url}
                  alt="Job"
                  className="w-full max-h-[420px] rounded-2xl border object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}
            <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">{job?.description || '—'}</div>
            {job?.access_instructions ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-slate-800">Access instructions</div>
                <div className="mt-1 whitespace-pre-wrap text-slate-700">{job.access_instructions}</div>
              </div>
            ) : null}
            {(job?.event_head_count != null || job?.event_menu_notes || job?.event_equipment) ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-slate-800">Event details</div>
                <div className="mt-2 space-y-2">
                  {job?.event_head_count != null ? <div><span className="font-medium text-slate-700">Head count:</span> {Number(job.event_head_count)} guests</div> : null}
                  {job?.event_menu_notes ? <div><span className="font-medium text-slate-700">Menu notes:</span><div className="mt-1 whitespace-pre-wrap text-slate-700">{job.event_menu_notes}</div></div> : null}
                  {job?.event_equipment ? <div><span className="font-medium text-slate-700">Equipment:</span><div className="mt-1 whitespace-pre-wrap text-slate-700">{job.event_equipment}</div></div> : null}
                </div>
              </div>
            ) : null}
            {(job?.scheduled_at || job?.recurring_frequency) ? (
              <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                {job?.scheduled_at ? (
                  <div>
                    <span className="font-semibold text-slate-700">Scheduled:</span>{' '}
                    {new Date(job.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    {job?.scheduled_end_at
                      ? ` – ${new Date(job.scheduled_end_at).toLocaleString(undefined, { timeStyle: 'short' })}`
                      : ''}
                  </div>
                ) : null}
                {job?.recurring_frequency ? (
                  <div>
                    <span className="font-semibold text-slate-700">Recurring:</span> {job.recurring_frequency}
                    {job?.recurring_end_date ? ` until ${new Date(job.recurring_end_date).toLocaleDateString()}` : ''}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Work proof (before/after)</div>
                <div className="mt-1 text-sm text-slate-600">
                  Photos/videos uploaded by the provider. This proof is automatically attached if a dispute is opened.
                </div>
              </div>
              <Button
                variant="secondary"
                disabled={proofsLoading}
                onClick={() =>
                  http
                    .get(`/jobs/${encodeURIComponent(id)}/proofs`)
                    .then((r) => setProofs(Array.isArray(r.data) ? r.data : []))
                    .catch(() => {})
                }
              >
                {proofsLoading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            {proofsError ? <div className="mt-2 text-sm text-amber-700">{proofsError}</div> : null}
            {proofsLoading && proofs.length === 0 ? <div className="mt-3 text-sm text-slate-600">Loading…</div> : null}
            {!proofsLoading && proofs.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No proof uploaded yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {proofs.slice(0, 20).map((p) => {
                  const media = Array.isArray(p?.media) ? p.media : []
                  return (
                    <div key={p.id} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-700">{String(p.kind || 'other').toUpperCase()}</div>
                      <div className="mt-1 text-xs text-slate-500">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
                      {p.note ? <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{p.note}</div> : null}
                      {media.length ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {media.slice(0, 6).map((m) => (
                            <div key={m.url} className="overflow-hidden rounded-2xl border bg-white">
                              {m.kind === 'video' ? (
                                <video src={m.url} controls className="h-56 w-full object-cover" />
                              ) : (
                                <img src={m.url} alt="Proof" className="h-56 w-full object-cover" loading="lazy" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {proofs.length > 20 ? <div className="text-xs text-slate-500">Showing 20 of {proofs.length} proof items.</div> : null}
              </div>
            )}
          </Card>

          <Card>
            <div className="text-sm font-semibold">Trust Wallet (escrow)</div>
            <div className="mt-2 text-sm text-slate-600">
              Recommended flow: accept a quote → fund escrow deposit → artisan works → artisan marks completed → you release funds.
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">🔒 Escrow protects your payment</div>
              <div className="mt-1">
                Pay into escrow (not directly to the provider). If something goes wrong, open a dispute to freeze escrow for support review.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setWhatIfOpen(true)}>
                  What happens if…?
                </Button>
                <Link to="/trust/escrow">
                  <Button variant="secondary">How escrow works</Button>
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/buyer/jobs/${id}/escrow`}>
                <Button variant="secondary">Open Trust Wallet</Button>
              </Link>
            </div>
          </Card>

          <Card id="quotes">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Quotes</div>
              {quotes.length >= 2 ? (
                <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${quotesViewMode === 'compare' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    onClick={() => setQuotesViewMode('compare')}
                  >
                    Compare
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${quotesViewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    onClick={() => setQuotesViewMode('table')}
                  >
                    Table
                  </button>
                </div>
              ) : null}
            </div>
            {quotes.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">
                No quotes yet. Tip: add clear photos/videos and a specific location to get faster responses.
              </div>
            ) : quotesViewMode === 'compare' && quotes.length >= 2 ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {quotes.map((q) => {
                  const price = q.quote_amount ?? q.quoteAmount ?? null
                  const startDays = q.start_within_days ?? q.startWithinDays ?? null
                  const availability = q.availability_text ?? q.availabilityText ?? null
                  const warrantyDays = q.warranty_days ?? q.warrantyDays ?? null
                  const includes = q.includes_materials ?? q.includesMaterials ?? null
                  const isSelected = selectedQuoteId === q.id
                  const avatar = q.artisan_profile_pic || '/locallink-logo.png'
                  const trustScore = q.artisan_trust_score ?? q.artisanTrustScore ?? null
                  const verificationTier = q.verification_tier ?? null
                  const profession =
                    q.artisan_primary_skill ||
                    (Array.isArray(q.artisan_skills) ? q.artisan_skills.filter(Boolean)[0] : null) ||
                    null
                  return (
                    <div
                      key={q.id}
                      className={['rounded-2xl border-2 bg-white p-4 transition-shadow', isSelected ? 'border-emerald-500 shadow-md' : 'border-slate-200 hover:border-slate-300'].join(' ')}
                      onClick={() => setSelectedQuoteId(q.id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedQuoteId(q.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Quote from ${q.artisan_name || 'artisan'}, GHS ${price ?? '—'}`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={avatar}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-2xl border border-slate-200 object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-900">{q.artisan_name || 'Artisan'}</div>
                          {profession ? <div className="mt-0.5 text-xs font-semibold text-slate-600">{String(profession)}</div> : null}
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <TrustBadge trustScore={trustScore} />
                            <VerificationBadge tier={verificationTier} />
                            <span className="text-xs font-semibold text-slate-700">
                              ★ {q.artisan_rating != null ? Number(q.artisan_rating).toFixed(1) : '0.0'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <div className="text-2xl font-bold text-slate-900">GHS {price ?? '—'}</div>
                        <div className="mt-1 text-xs text-slate-500">🔒 Escrow protected</div>
                      </div>
                      <dl className="mt-3 space-y-1.5 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500">Availability</dt>
                          <dd className="text-slate-900">
                            {startDays != null ? `Start within ${startDays} day(s)` : '—'}
                            {availability ? ` · ${availability.slice(0, 60)}${availability.length > 60 ? '…' : ''}` : ''}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Warranty</dt>
                          <dd className="text-slate-900">{warrantyDays != null ? `${warrantyDays} day(s)` : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Materials</dt>
                          <dd className="text-slate-900">
                            {includes === true ? 'Included' : includes === false ? 'Not included' : '—'}
                          </dd>
                        </div>
                      </dl>
                      {q.message ? (
                        <div className="mt-3 line-clamp-3 text-xs text-slate-600 whitespace-pre-wrap">{q.message}</div>
                      ) : null}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {q.artisan_user_id ? (
                          <Link to={`/u/${q.artisan_user_id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-emerald-700 hover:underline">
                            View profile
                          </Link>
                        ) : null}
                        <Button
                          className="ml-auto"
                          disabled={busyQuoteId === q.id || q.status === 'accepted'}
                          onClick={(e) => {
                            e.stopPropagation()
                            acceptQuote(q.id)
                          }}
                        >
                          {q.status === 'accepted' ? 'Accepted' : busyQuoteId === q.id ? 'Accepting…' : 'Accept'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border bg-white">
                <table className="min-w-[900px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr className="border-b">
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Quote</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Warranty</th>
                      <th className="px-4 py-3">Materials</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {quotes.map((q) => {
                      const price = q.quote_amount ?? q.quoteAmount ?? null
                      const startDays = q.start_within_days ?? q.startWithinDays ?? null
                      const availability = q.availability_text ?? q.availabilityText ?? null
                      const warrantyDays = q.warranty_days ?? q.warrantyDays ?? null
                      const includes = q.includes_materials ?? q.includesMaterials ?? null
                      const isSelected = selectedQuoteId === q.id
                      const avatar = q.artisan_profile_pic || '/locallink-logo.png'
                      const trustScore = q.artisan_trust_score ?? q.artisanTrustScore ?? null
                      const verificationTier = q.verification_tier ?? null
                      const profession =
                        q.artisan_primary_skill ||
                        (Array.isArray(q.artisan_skills) ? q.artisan_skills.filter(Boolean)[0] : null) ||
                        null
                      return (
                        <tr
                          key={q.id}
                          className={['align-top cursor-pointer hover:bg-slate-50', isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/40' : ''].join(' ')}
                          onClick={() => setSelectedQuoteId(q.id)}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="radio"
                              name="selected_quote"
                              checked={isSelected}
                              onChange={() => setSelectedQuoteId(q.id)}
                              aria-label={`Select quote from ${q.artisan_name || 'artisan'}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <img
                                src={avatar}
                                alt=""
                                className="h-10 w-10 rounded-2xl border border-slate-200 object-cover"
                                loading="lazy"
                              />
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-slate-900">{q.artisan_name ? q.artisan_name : 'Artisan'}</div>
                                {profession ? <div className="mt-0.5 text-xs font-semibold text-slate-600">{String(profession)}</div> : null}
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <TrustBadge trustScore={trustScore} />
                                  <VerificationBadge tier={verificationTier} />
                                  <span className="text-xs font-semibold text-slate-700">
                                    ★ {q.artisan_rating != null ? Number(q.artisan_rating).toFixed(1) : '0.0'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {q.message ? <div className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">{q.message}</div> : null}
                            {q.artisan_user_id ? (
                              <div className="mt-2">
                                <Link to={`/u/${q.artisan_user_id}`} className="text-xs font-semibold text-emerald-700 hover:underline">
                                  View profile
                                </Link>
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">GHS {price ?? '—'}</div>
                            <div className="mt-1 text-xs text-slate-500">🔒 Escrow protected</div>
                          </td>
                          <td className="px-4 py-3">
                            {startDays != null ? <div className="text-slate-900">Start within {startDays} day(s)</div> : <div className="text-slate-500">—</div>}
                            {availability ? <div className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{availability}</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            {warrantyDays != null ? <div className="text-slate-900">{warrantyDays} day(s)</div> : <div className="text-slate-500">—</div>}
                          </td>
                          <td className="px-4 py-3">
                            {includes === true ? <div className="text-slate-900">Included</div> : includes === false ? <div className="text-slate-900">Not included</div> : <div className="text-slate-500">—</div>}
                          </td>
                          <td className="px-4 py-3">
                            <StatusPill status={q.status || 'pending'} />
                          </td>
                          <td className="px-4 py-3">
                            <Button disabled={busyQuoteId === q.id || q.status === 'accepted'} onClick={() => acceptQuote(q.id)}>
                              {q.status === 'accepted' ? 'Accepted' : busyQuoteId === q.id ? 'Accepting…' : 'Accept'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {quotes.length ? (
            <StickyActionBar
              left={
                selectedQuoteId ? (
                  <div className="text-xs text-slate-700">
                    Selected:{' '}
                    <span className="font-semibold">
                      {(() => {
                        const q = quotes.find((x) => x.id === selectedQuoteId)
                        if (!q) return '—'
                        const prof =
                          q.artisan_primary_skill ||
                          (Array.isArray(q.artisan_skills) ? q.artisan_skills.filter(Boolean)[0] : null) ||
                          null
                        return `${q.artisan_name || 'Artisan'}${prof ? ` (${String(prof)})` : ''} • GHS ${q.quote_amount ?? q.quoteAmount ?? '—'}`
                      })()}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-600">Select a quote to accept.</div>
                )
              }
              right={
                <Button
                  disabled={!selectedQuoteId || busyQuoteId === selectedQuoteId || quotes.find((q) => q.id === selectedQuoteId)?.status === 'accepted'}
                  onClick={() => selectedQuoteId && acceptQuote(selectedQuoteId)}
                >
                  Accept
                </Button>
              }
            />
          ) : null}
        </>
      )}
    </div>
  )
}


