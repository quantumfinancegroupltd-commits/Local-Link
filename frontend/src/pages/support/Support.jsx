import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { clearDraft, useDraftAutosave } from '../../lib/drafts.js'
import { openAssistant } from '../../components/assistant/AssistantFab.jsx'

function renderAttachments(attachments) {
  const list = Array.isArray(attachments) ? attachments.filter(Boolean) : []
  if (!list.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {list.slice(0, 12).map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
          {String(u).match(/\.(mp4|webm|mov)(\?|#|$)/i) ? (
            <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700">
              Video attachment
              <span className="text-slate-400">•</span>
              Open
            </div>
          ) : (
            <img src={u} alt="attachment" className="h-16 w-16 rounded-xl border object-cover" loading="lazy" />
          )}
        </a>
      ))}
    </div>
  )
}

function statusBadge(status) {
  const s = String(status || 'open')
  const base = 'rounded-full px-2 py-1 text-xs font-semibold'
  if (s === 'resolved' || s === 'closed') return `${base} bg-emerald-100 text-emerald-800`
  if (s === 'pending_user') return `${base} bg-amber-100 text-amber-800`
  if (s === 'pending_admin') return `${base} bg-slate-100 text-slate-700`
  return `${base} bg-blue-100 text-blue-800`
}

export function Support() {
  const [searchParams] = useSearchParams()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [creating, setCreating] = useState(false)
  const [category, setCategory] = useState('general')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [relatedType, setRelatedType] = useState('')
  const [relatedId, setRelatedId] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [createFiles, setCreateFiles] = useState([])

  const [active, setActive] = useState(null) // ticket
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [replyError, setReplyError] = useState(null)
  const [replyFiles, setReplyFiles] = useState([])

  const createDraftKey = 'draft:support:create_ticket'
  const createDraftData = useMemo(
    () => ({
      category,
      subject,
      description,
      relatedType,
      relatedId,
      saved_at: Date.now(),
    }),
    [category, subject, description, relatedType, relatedId],
  )
  const createDraft = useDraftAutosave({ key: createDraftKey, data: createDraftData, enabled: creating, debounceMs: 700 })

  const replyDraftKey = active?.id ? `draft:support:reply:${active.id}` : null
  const replyDraftData = useMemo(() => ({ body: reply, saved_at: Date.now() }), [reply])
  const replyDraft = useDraftAutosave({ key: replyDraftKey, data: replyDraftData, enabled: !!active?.id, debounceMs: 700 })

  async function loadTickets() {
    setLoading(true)
    setError(null)
    try {
      const r = await http.get('/support/tickets')
      setTickets(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load support tickets')
    } finally {
      setLoading(false)
    }
  }

  async function openTicket(t) {
    setActive(t)
    setEvents([])
    setEventsLoading(true)
    try {
      const r = await http.get(`/support/tickets/${t.id}`)
      setEvents(Array.isArray(r.data?.events) ? r.data.events : [])
    } catch {
      // best-effort
    } finally {
      setEventsLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [])

  useEffect(() => {
    const qSubject = searchParams.get('subject')
    const qDescription = searchParams.get('description')
    const qCategory = searchParams.get('category')
    const qRelatedType = searchParams.get('related_type')
    const qRelatedId = searchParams.get('related_id')

    const hasAny = qSubject || qDescription || qCategory || qRelatedType || qRelatedId
    if (!hasAny) return

    setCreating(true)
    if (qCategory) setCategory(qCategory)
    if (qSubject) setSubject(qSubject)
    if (qDescription) setDescription(qDescription)
    if (qRelatedType) setRelatedType(qRelatedType)
    if (qRelatedId) setRelatedId(qRelatedId)
  }, [searchParams])

  // Restore create-ticket draft when opening the create form (if empty).
  useEffect(() => {
    if (!creating) return
    const empty = !subject && !description && !relatedType && !relatedId
    if (!empty) return
    const d = createDraft.load()
    if (!d) return
    if (d.category) setCategory(String(d.category))
    if (d.subject) setSubject(String(d.subject))
    if (d.description) setDescription(String(d.description))
    if (d.relatedType) setRelatedType(String(d.relatedType))
    if (d.relatedId) setRelatedId(String(d.relatedId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating])

  // Restore reply draft when switching tickets.
  useEffect(() => {
    if (!active?.id) return
    if (reply && reply.trim()) return
    const d = replyDraft.load()
    if (!d?.body) return
    setReply(String(d.body))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  const activeSubject = useMemo(() => (active?.subject ? String(active.subject) : ''), [active])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader kicker="Support" title="Help & Support" subtitle="Create a ticket and track replies from the LocalLink team." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Ask YAO</div>
                <div className="text-xs text-slate-500">Escrow, jobs, verification, disputes</div>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Get instant answers about how the platform works. For account-specific issues, open a support ticket.
            </p>
            <Button type="button" className="mt-3 w-full" onClick={openAssistant}>
              Chat with YAO
            </Button>
          </Card>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Create ticket</div>
              <Button variant="secondary" type="button" onClick={() => setCreating((v) => !v)}>
                {creating ? 'Close' : 'New'}
              </Button>
            </div>
            {creating ? (
              <form
                className="mt-4 space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setCreateBusy(true)
                  setCreateError(null)
                  try {
                    await http.post('/support/tickets', {
                      category,
                      subject,
                      description,
                      related_type: relatedType || null,
                      related_id: relatedId || null,
                      attachments: createFiles.length ? (await uploadMediaFiles(createFiles)).map((x) => x.url).filter(Boolean) : null,
                    })
                    setSubject('')
                    setDescription('')
                    setCategory('general')
                    setRelatedType('')
                    setRelatedId('')
                    setCreateFiles([])
                    clearDraft(createDraftKey)
                    setCreating(false)
                    await loadTickets()
                  } catch (err) {
                    setCreateError(err?.response?.data?.message ?? err?.message ?? 'Failed to create ticket')
                  } finally {
                    setCreateBusy(false)
                  }
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div>Draft autosaves while you type (attachments are not saved).</div>
                  <div className="flex items-center gap-2">
                    {createDraft.savedAt ? <span className="text-emerald-700">Saved</span> : <span>Not saved yet</span>}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        clearDraft(createDraftKey)
                        setSubject('')
                        setDescription('')
                        setCategory('general')
                        setRelatedType('')
                        setRelatedId('')
                        setCreateFiles([])
                      }}
                    >
                      Clear draft
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={createBusy}>
                    <option value="general">General</option>
                    <option value="account">Account</option>
                    <option value="jobs">Jobs</option>
                    <option value="orders">Orders</option>
                    <option value="delivery">Delivery</option>
                    <option value="escrow">Escrow</option>
                    <option value="verification">Verification</option>
                    <option value="dispute">Dispute</option>
                    <option value="fraud">Fraud / safety</option>
                    <option value="payouts">Payouts</option>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={createBusy} />
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    disabled={createBusy}
                  />
                </div>
                <div>
                  <Label>Attachments (optional)</Label>
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={createBusy}
                    onChange={(e) => setCreateFiles(Array.from(e.target.files ?? []))}
                  />
                  {createFiles.length ? <div className="mt-1 text-xs text-slate-600">{createFiles.length} file(s) selected</div> : null}
                </div>
                {(relatedType || relatedId) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Attached context</div>
                    <div className="mt-1">
                      {relatedType ? <span className="mr-2">Type: {relatedType}</span> : null}
                      {relatedId ? <span>ID: {relatedId}</span> : null}
                    </div>
                  </div>
                )}
                {createError ? <div className="text-sm text-red-700">{createError}</div> : null}
                <Button disabled={createBusy}>{createBusy ? 'Creating…' : 'Create ticket'}</Button>
              </form>
            ) : (
              <div className="mt-3 text-sm text-slate-600">Use “New” to contact support.</div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">My tickets</div>
              <Button variant="secondary" type="button" onClick={loadTickets} disabled={loading}>
                Refresh
              </Button>
            </div>
            {loading ? (
              <div className="mt-3 text-sm text-slate-600">Loading…</div>
            ) : error ? (
              <div className="mt-3 text-sm text-red-700">{error}</div>
            ) : tickets.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No tickets yet.</div>
            ) : (
              <div className="mt-3 divide-y">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTicket(t)}
                    className="w-full px-1 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{t.subject}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-600">{t.category}</div>
                      </div>
                      <span className={statusBadge(t.status)}>{t.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          {!active ? (
            <EmptyState title="Select a ticket" description="Choose a ticket on the left to see replies and add more details." />
          ) : (
            <>
              <Card>
                <div className="text-sm font-semibold">{activeSubject}</div>
                <div className="mt-2 text-xs text-slate-500">
                  Status: <span className="font-semibold">{active.status}</span> • Category:{' '}
                  <span className="font-semibold">{active.category}</span>
                </div>
              </Card>

              <Card>
                <div className="text-sm font-semibold">Conversation</div>
                {eventsLoading ? (
                  <div className="mt-3 text-sm text-slate-600">Loading…</div>
                ) : events.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">No messages yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {events.map((e) => (
                      <div key={e.id} className="rounded-2xl border bg-slate-50 p-4">
                        <div className="text-xs text-slate-500">{new Date(e.created_at).toLocaleString()}</div>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{e.body}</div>
                        {renderAttachments(e.attachments)}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <div className="text-sm font-semibold">Reply</div>
                <form
                  className="mt-3 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!reply.trim()) return
                    setReplyBusy(true)
                    setReplyError(null)
                    try {
                      const urls = replyFiles.length ? (await uploadMediaFiles(replyFiles)).map((x) => x.url).filter(Boolean) : null
                      await http.post(`/support/tickets/${active.id}/reply`, { body: reply.trim(), attachments: urls })
                      setReply('')
                      setReplyFiles([])
                      if (replyDraftKey) clearDraft(replyDraftKey)
                      await openTicket(active)
                      await loadTickets()
                    } catch (err) {
                      setReplyError(err?.response?.data?.message ?? err?.message ?? 'Failed to send reply')
                    } finally {
                      setReplyBusy(false)
                    }
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div>Draft autosaves while you type (attachments are not saved).</div>
                    <div className="flex items-center gap-2">
                      {replyDraft.savedAt ? <span className="text-emerald-700">Saved</span> : <span>Not saved yet</span>}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          if (replyDraftKey) clearDraft(replyDraftKey)
                          setReply('')
                          setReplyFiles([])
                        }}
                      >
                        Clear draft
                      </Button>
                    </div>
                  </div>
                  <textarea
                    className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add more details, screenshots (as links), timelines…"
                    disabled={replyBusy}
                  />
                  <div>
                    <Label>Attachments (optional)</Label>
                    <Input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      disabled={replyBusy}
                      onChange={(e) => setReplyFiles(Array.from(e.target.files ?? []))}
                    />
                    {replyFiles.length ? <div className="mt-1 text-xs text-slate-600">{replyFiles.length} file(s) selected</div> : null}
                  </div>
                  {replyError ? <div className="text-sm text-red-700">{replyError}</div> : null}
                  <Button disabled={replyBusy}>{replyBusy ? 'Sending…' : 'Send reply'}</Button>
                </form>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


