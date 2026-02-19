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
  const [quoteTemplates, setQuoteTemplates] = useState([])
  const [quoteTemplatesLoading, setQuoteTemplatesLoading] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [saveTemplateBusy, setSaveTemplateBusy] = useState(false)

  const [proofs, setProofs] = useState([])
  const [proofsLoading, setProofsLoading] = useState(false)
  const [proofsError, setProofsError] = useState(null)
  const [proofKind, setProofKind] = useState('before')
  const [proofNote, setProofNote] = useState('')
  const [proofFiles, setProofFiles] = useState([])
  const [proofBusy, setProofBusy] = useState(false)

  const [clientNotes, setClientNotes] = useState('')
  const [clientNotesLoading, setClientNotesLoading] = useState(false)
  const [clientNotesSaving, setClientNotesSaving] = useState(false)

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

  useEffect(() => {
    if (job?.status !== 'open' || submitted) return
    let cancelled = false
    async function load() {
      setQuoteTemplatesLoading(true)
      try {
        const res = await http.get('/artisan/quote-templates')
        if (!cancelled) setQuoteTemplates(Array.isArray(res.data) ? res.data : [])
      } catch {
        if (!cancelled) setQuoteTemplates([])
      } finally {
        if (!cancelled) setQuoteTemplatesLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, job?.status, submitted])

  useEffect(() => {
    const buyerId = job?.buyer_id
    if (!buyerId) {
      setClientNotes('')
      return
    }
    let cancelled = false
    setClientNotesLoading(true)
    http.get(`/artisan/client-notes/${encodeURIComponent(buyerId)}`)
      .then((r) => {
        if (!cancelled) setClientNotes(r.data?.notes ?? '')
      })
      .catch(() => { if (!cancelled) setClientNotes('') })
      .finally(() => { if (!cancelled) setClientNotesLoading(false) })
    return () => { cancelled = true }
  }, [job?.buyer_id])

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

  function applyQuoteTemplate(template) {
    if (!template) return
    setQuoteAmount(template.quote_amount != null ? String(template.quote_amount) : '')
    setMessage(template.message ?? '')
    setAvailabilityText(template.availability_text ?? '')
    setStartWithinDays(template.start_within_days != null ? String(template.start_within_days) : '')
    setWarrantyDays(template.warranty_days != null ? String(template.warranty_days) : '')
    setIncludesMaterials(Boolean(template.includes_materials))
  }

  async function handleSaveQuoteAsTemplate(e) {
    e.preventDefault()
    const name = String(saveTemplateName ?? '').trim()
    if (!name) {
      toast.warning('Enter a name', 'Give this template a name to save it.')
      return
    }
    if (saveTemplateBusy) return
    setSaveTemplateBusy(true)
    try {
      await http.post('/artisan/quote-templates', {
        name,
        message: message || null,
        quote_amount: quoteAmount ? Number(quoteAmount) : null,
        availability_text: availabilityText || null,
        start_within_days: startWithinDays ? Number(startWithinDays) : null,
        warranty_days: warrantyDays ? Number(warrantyDays) : null,
        includes_materials: includesMaterials,
      })
      const res = await http.get('/artisan/quote-templates')
      setQuoteTemplates(Array.isArray(res.data) ? res.data : [])
      setSaveTemplateName('')
      toast.success('Saved', 'Quote template saved.')
    } catch (err) {
      toast.error('Failed', err?.response?.data?.message ?? err?.message ?? 'Could not save template')
    } finally {
      setSaveTemplateBusy(false)
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

  async function saveClientNotes() {
    const buyerId = job?.buyer_id
    if (!buyerId) return
    setClientNotesSaving(true)
    try {
      await http.put(`/artisan/client-notes/${encodeURIComponent(buyerId)}`, { notes: clientNotes || null })
      toast.success('Notes saved')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save notes')
    } finally {
      setClientNotesSaving(false)
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
            subtitle={
              [
                job?.location || null,
                job?.scheduled_at ? `Scheduled: ${new Date(job.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : null,
                job?.recurring_frequency ? `Recurring: ${job.recurring_frequency}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'
            }
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
            {job?.access_instructions ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm">
                <div className="font-semibold text-amber-900">Access instructions</div>
                <div className="mt-1 whitespace-pre-wrap text-slate-800">{job.access_instructions}</div>
              </div>
            ) : null}
            {(job?.event_head_count != null || job?.event_menu_notes || job?.event_equipment) ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="font-semibold text-slate-800">Event details</div>
                <div className="mt-2 space-y-2">
                  {job?.event_head_count != null ? (
                    <div><span className="font-medium text-slate-700">Head count:</span> {Number(job.event_head_count)} guests</div>
                  ) : null}
                  {job?.event_menu_notes ? (
                    <div><span className="font-medium text-slate-700">Menu / catering notes:</span><div className="mt-1 whitespace-pre-wrap text-slate-700">{job.event_menu_notes}</div></div>
                  ) : null}
                  {job?.event_equipment ? (
                    <div><span className="font-medium text-slate-700">Equipment needed:</span><div className="mt-1 whitespace-pre-wrap text-slate-700">{job.event_equipment}</div></div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {(job?.scheduled_at || job?.recurring_frequency) ? (
              <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                {job?.scheduled_at ? (
                  <div>
                    <span className="font-semibold text-slate-700">Scheduled:</span>{' '}
                    {new Date(job.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    {job?.scheduled_end_at ? ` – ${new Date(job.scheduled_end_at).toLocaleString(undefined, { timeStyle: 'short' })}` : ''}
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

          {job?.buyer_id ? (
            <Card>
              <div className="text-sm font-semibold text-slate-900">Private notes about this client</div>
              <p className="mt-1 text-xs text-slate-500">Only you can see these. Use them to remember preferences, access details, or follow-ups.</p>
              {clientNotesLoading ? (
                <div className="mt-3 text-sm text-slate-600">Loading…</div>
              ) : (
                <>
                  <Textarea
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="e.g. Prefers morning slots, gate code 1234…"
                    rows={3}
                    className="mt-3"
                  />
                  <Button
                    type="button"
                    className="mt-2"
                    disabled={clientNotesSaving}
                    onClick={saveClientNotes}
                  >
                    {clientNotesSaving ? 'Saving…' : 'Save notes'}
                  </Button>
                </>
              )}
            </Card>
          ) : null}

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
              <>
                {quoteTemplates.length > 0 && !quoteTemplatesLoading && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Label className="!mb-0">Start from a template</Label>
                    <Select
                      value=""
                      onChange={(e) => {
                        const templateId = e.target.value
                        if (!templateId) return
                        const t = quoteTemplates.find((x) => x.id === templateId)
                        if (t) applyQuoteTemplate(t)
                        e.target.value = ''
                      }}
                      className="max-w-xs"
                    >
                      <option value="">Choose…</option>
                      {quoteTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.quote_amount != null ? ` — GHS ${Number(t.quote_amount).toFixed(0)}` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
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

                <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="save_quote_template_name" className="text-xs text-slate-600">Save as template</Label>
                    <Input
                      id="save_quote_template_name"
                      value={saveTemplateName}
                      onChange={(e) => setSaveTemplateName(e.target.value)}
                      placeholder="e.g. Standard cleaning quote"
                      className="mt-1 max-w-xs"
                      disabled={saveTemplateBusy}
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={handleSaveQuoteAsTemplate} disabled={saveTemplateBusy}>
                    {saveTemplateBusy ? 'Saving…' : 'Save template'}
                  </Button>
                </div>
                <div className="text-xs text-slate-500">Reuse this quote text and amount on similar jobs.</div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


