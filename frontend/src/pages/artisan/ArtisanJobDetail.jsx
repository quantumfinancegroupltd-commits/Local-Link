import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

export function ArtisanJobDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState(null)

  const [quoteAmount, setQuoteAmount] = useState('')
  const [message, setMessage] = useState('')
  const [availabilityText, setAvailabilityText] = useState('')
  const [startWithinDays, setStartWithinDays] = useState('')
  const [warrantyDays, setWarrantyDays] = useState('')
  const [includesMaterials, setIncludesMaterials] = useState(false)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const [proofs, setProofs] = useState([])
  const [proofsLoading, setProofsLoading] = useState(false)
  const [proofsError, setProofsError] = useState(null)
  const [proofKind, setProofKind] = useState('before')
  const [proofNote, setProofNote] = useState('')
  const [proofFiles, setProofFiles] = useState([])
  const [proofBusy, setProofBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get(`/jobs/${id}`)
        if (!cancelled) setJob(res.data?.job ?? res.data ?? null)
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

  const canUseProof = useMemo(() => {
    const s = String(job?.status || '')
    return ['assigned', 'in_progress', 'completed'].includes(s)
  }, [job?.status])

  const proofCounts = useMemo(() => {
    const list = Array.isArray(proofs) ? proofs : []
    let before = 0
    let after = 0
    let other = 0
    for (const p of list) {
      const k = String(p?.kind || 'other')
      if (k === 'before') before += 1
      else if (k === 'after') after += 1
      else other += 1
    }
    return { total: list.length, before, after, other }
  }, [proofs])

  function scrollToProof() {
    try {
      document.getElementById('work-proof')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const s = String(job?.status || '')
    if (s === 'assigned' && proofKind !== 'before') setProofKind('before')
    if (s === 'in_progress' && proofKind !== 'after') setProofKind('after')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status])

  async function loadProofs() {
    setProofsLoading(true)
    setProofsError(null)
    try {
      const r = await http.get(`/jobs/${encodeURIComponent(id)}/proofs`)
      setProofs(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setProofsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load proof')
      setProofs([])
    } finally {
      setProofsLoading(false)
    }
  }

  useEffect(() => {
    if (!canUseProof) return
    loadProofs().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseProof, id])

  async function addProof(e) {
    e.preventDefault()
    if (!canUseProof) return toast.warning('Not available', 'Work proof is available after a job is booked.')
    if (proofBusy) return
    setProofBusy(true)
    try {
      let media = null
      if (Array.isArray(proofFiles) && proofFiles.length) {
        const uploaded = await uploadMediaFiles(proofFiles)
        media = Array.isArray(uploaded) ? uploaded : null
      }
      await http.post(`/jobs/${encodeURIComponent(id)}/proofs`, {
        kind: proofKind,
        note: proofNote || null,
        media,
      })
      setProofNote('')
      setProofFiles([])
      toast.success('Saved', 'Work proof uploaded.')
      await loadProofs().catch(() => {})
    } catch (err) {
      toast.error('Upload failed', err?.response?.data?.message ?? err?.message ?? 'Failed to upload proof')
    } finally {
      setProofBusy(false)
    }
  }

  async function submitQuote(e) {
    e.preventDefault()
    setSubmitError(null)
    setBusy(true)
    try {
      await http.post(`/jobs/${id}/quote`, {
        quote_amount: Number(quoteAmount),
        message,
        availability_text: availabilityText || null,
        start_within_days: startWithinDays ? Number(startWithinDays) : null,
        warranty_days: warrantyDays ? Number(warrantyDays) : null,
        includes_materials: includesMaterials || false,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Failed to submit quote')
    } finally {
      setBusy(false)
    }
  }

  async function startJob() {
    if (String(job?.status || '') === 'assigned') {
      if (proofsLoading) {
        toast.warning('Please wait', 'Loading work proof status…')
        return
      }
      if (proofCounts.before === 0) {
        scrollToProof()
        const ok = window.confirm('Before you start: upload at least 1 BEFORE photo/video as proof. Start anyway?')
        if (!ok) return
      }
    }
    setActionBusy(true)
    setActionMsg(null)
    try {
      await http.post(`/jobs/${id}/start`)
      const res = await http.get(`/jobs/${id}`)
      setJob(res.data?.job ?? res.data ?? null)
      setActionMsg('Job marked as in progress.')
    } catch (err) {
      setActionMsg(err?.response?.data?.message ?? err?.message ?? 'Failed to start job')
    } finally {
      setActionBusy(false)
    }
  }

  async function completeJob() {
    if (String(job?.status || '') === 'in_progress') {
      if (proofsLoading) {
        toast.warning('Please wait', 'Loading work proof status…')
        return
      }
      if (proofCounts.after === 0) {
        scrollToProof()
        const ok = window.confirm('Before you mark complete: upload at least 1 AFTER photo/video as proof. Complete anyway?')
        if (!ok) return
      }
    }
    setActionBusy(true)
    setActionMsg(null)
    try {
      await http.post(`/jobs/${id}/complete`)
      const res = await http.get(`/jobs/${id}`)
      setJob(res.data?.job ?? res.data ?? null)
      setActionMsg('Job marked completed. Waiting for buyer confirmation.')
    } catch (err) {
      setActionMsg(err?.response?.data?.message ?? err?.message ?? 'Failed to complete job')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <EmptyState
          title="Job not available"
          description={error}
          actions={
            <Link to="/artisan">
              <Button variant="secondary">Back to jobs</Button>
            </Link>
          }
        />
      ) : (
        <>
          <PageHeader
            kicker="Job"
            title={job?.title || 'Job'}
            subtitle={job?.location || '—'}
            actions={
              <>
                <StatusPill status={job?.status || 'open'} />
                <Link to="/artisan">
                  <Button variant="secondary">Back</Button>
                </Link>
                <Link to={`/messages/job/${id}`}>
                  <Button variant="secondary">Message buyer</Button>
                </Link>
                <Link to={`/artisan/jobs/${encodeURIComponent(id)}/escrow`}>
                  <Button variant="secondary">Escrow</Button>
                </Link>
              </>
            }
          />

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Buyer budget</div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
                {job?.budget != null && Number(job.budget) > 0 ? `GHS ${Number(job.budget).toFixed(0)}` : 'Not specified'}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Use this as a reference — you can still quote your real cost based on scope and materials.
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
              <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
                <img src={job.image_url} alt="Job" className="h-56 w-full object-cover" loading="lazy" />
              </div>
            ) : null}
            <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{job?.description || '—'}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={actionBusy || job?.status !== 'assigned'} onClick={startJob}>
                {actionBusy ? 'Working…' : 'Start job'}
              </Button>
              <Button variant="secondary" disabled={actionBusy || job?.status !== 'in_progress'} onClick={completeJob}>
                {actionBusy ? 'Working…' : 'Mark completed'}
              </Button>
            </div>
            {actionMsg ? <div className="mt-3 text-sm text-slate-700">{actionMsg}</div> : null}
          </Card>

          <Card id="work-proof">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Work proof (before/after)</div>
                <div className="mt-1 text-sm text-slate-600">
                  Upload photos/videos as evidence of work. This proof is automatically attached if a dispute is opened.
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => loadProofs().catch(() => {})} disabled={!canUseProof || proofsLoading}>
                {proofsLoading ? 'Loading…' : 'Refresh'}
              </Button>
            </div>
            {canUseProof ? (
              <div className="mt-2 text-xs text-slate-500">
                Proof counts: before {proofCounts.before} • after {proofCounts.after} • other {proofCounts.other}
              </div>
            ) : null}

            {!canUseProof ? (
              <div className="mt-3 text-sm text-slate-600">Available after a job is booked (assigned).</div>
            ) : (
              <>
                <form onSubmit={addProof} className="mt-4 grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <Label>Type</Label>
                    <Select value={proofKind} onChange={(e) => setProofKind(e.target.value)} disabled={proofBusy}>
                      <option value="before">Before</option>
                      <option value="after">After</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <Label>Note (optional)</Label>
                    <Input value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="e.g. initial condition / materials used / final result" disabled={proofBusy} />
                  </div>
                  <div className="md:col-span-5">
                    <Label>Files</Label>
                    <Input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => setProofFiles(Array.from(e.target.files || []))}
                      disabled={proofBusy}
                    />
                    {proofFiles.length ? (
                      <div className="mt-1 text-xs text-slate-600">
                        Selected: {proofFiles.map((f) => f.name).slice(0, 4).join(', ')}
                        {proofFiles.length > 4 ? ` (+${proofFiles.length - 4} more)` : ''}
                      </div>
                    ) : null}
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <Button disabled={proofBusy} className="w-full">
                      {proofBusy ? 'Uploading…' : 'Upload'}
                    </Button>
                  </div>
                </form>

                {proofsError ? <div className="mt-3 text-sm text-red-700">{proofsError}</div> : null}

                {proofs.length === 0 && !proofsLoading ? (
                  <div className="mt-3 text-sm text-slate-600">No proof uploaded yet.</div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {proofs.slice(0, 20).map((p) => {
                      const media = Array.isArray(p?.media) ? p.media : []
                      return (
                        <div key={p.id} className="rounded-2xl border bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-slate-700">{String(p.kind || 'other').toUpperCase()}</div>
                              <div className="mt-1 text-xs text-slate-500">{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
                              {p.note ? <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{p.note}</div> : null}
                            </div>
                          </div>
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
              </>
            )}
          </Card>

          <Card>
            <div className="text-sm font-semibold">Submit a quote</div>
            {job?.status !== 'open' ? (
              <div className="mt-2 text-sm text-slate-600">
                This job is <span className="font-semibold">{job?.status}</span>. Quotes are only available while the job is open.
              </div>
            ) : null}
            {submitted ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Quote submitted. You can track it in the next Phase of the MVP.
              </div>
            ) : (
              <form onSubmit={submitQuote} className="mt-4 space-y-4">
                <div>
                  <Label>Quote amount (GHS)</Label>
                  <Input
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                    type="number"
                    min="1"
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Start within (days)</Label>
                    <Input
                      value={startWithinDays}
                      onChange={(e) => setStartWithinDays(e.target.value)}
                      type="number"
                      min="0"
                      placeholder="e.g. 2"
                    />
                  </div>
                  <div>
                    <Label>Warranty (days)</Label>
                    <Input
                      value={warrantyDays}
                      onChange={(e) => setWarrantyDays(e.target.value)}
                      type="number"
                      min="0"
                      placeholder="e.g. 30"
                    />
                  </div>
                </div>
                <div>
                  <Label>Availability note (optional)</Label>
                  <Input
                    value={availabilityText}
                    onChange={(e) => setAvailabilityText(e.target.value)}
                    placeholder="e.g. Available evenings / Can inspect first"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="includes_materials"
                    type="checkbox"
                    checked={includesMaterials}
                    onChange={(e) => setIncludesMaterials(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="includes_materials">Includes materials</Label>
                </div>
                <div>
                  <Label>Message (optional)</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <Button disabled={busy || job?.status !== 'open'}>{busy ? 'Submitting…' : 'Submit quote'}</Button>
              </form>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


