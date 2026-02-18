import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { ImageCropperModal } from '../../components/ui/ImageCropperModal.jsx'
import { VerifyAccountBanner } from '../../components/verification/VerifyAccountBanner.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { useDraftAutosave } from '../../lib/drafts.js'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'
import { JOB_CATEGORIES_TIER1 } from '../../lib/jobCategories.js'
import { getRoleLabel, getStoredFarmerVertical, getFarmerVerticalLabel } from '../../lib/roles.js'
import { WorkHistoryCard } from '../../components/profile/WorkHistory.jsx'
import { SkillEndorsementsCard } from '../../components/profile/SkillEndorsements.jsx'
import { ExperienceBadgesRow } from '../../components/profile/ExperienceBadges.jsx'
import { ExperienceBadgesModal } from '../../components/profile/ExperienceBadgesModal.jsx'
import { LikersModal } from '../../components/social/LikersModal.jsx'

function kindLabel(kind) {
  if (kind === 'experience') return 'Experience'
  if (kind === 'education') return 'Education'
  if (kind === 'certification') return 'Certifications'
  if (kind === 'qualification') return 'Qualifications'
  if (kind === 'award') return 'Awards'
  return 'Resume'
}

function normalizeDateOnly(v) {
  const raw = v == null ? '' : String(v).trim()
  if (!raw) return ''
  // If backend ever sends an ISO datetime, strip to YYYY-MM-DD.
  if (raw.includes('T')) return raw.split('T')[0]
  // If user entered YYYY-MM, coerce to first day so <input type="date"> can render.
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`
  return raw
}

function titleCaseWords(s) {
  const raw = String(s || '').trim()
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function ResumeEditor({ entries, onCreate, onUpdate, onDelete, busyId }) {
  const byKind = useMemo(() => {
    const kinds = ['experience', 'education', 'certification', 'qualification', 'award']
    const map = new Map()
    for (const k of kinds) map.set(k, [])
    for (const e of Array.isArray(entries) ? entries : []) {
      const k = e?.kind || 'experience'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(e)
    }
    return map
  }, [entries])

  function EntryForm({ e }) {
    const [draft, setDraft] = useState(() => ({
      ...e,
      start_date: normalizeDateOnly(e?.start_date),
      end_date: normalizeDateOnly(e?.end_date),
    }))
    useEffect(() => setDraft({ ...e }), [e?.id])

    const saving = busyId === e?.id
    const canAttachProof = ['education', 'certification', 'qualification'].includes(String(draft.kind || ''))
    const media = Array.isArray(draft?.media) ? draft.media : []
    const [uploadingProof, setUploadingProof] = useState(false)
    const [proofError, setProofError] = useState(null)

    async function addProofImages(fileList) {
      const files = Array.from(fileList || []).filter(Boolean)
      if (!files.length) return
      const left = Math.max(0, 3 - media.length)
      if (left <= 0) return

      setUploadingProof(true)
      setProofError(null)
      try {
        const toUpload = files.slice(0, left)
        const uploaded = await uploadMediaFiles(toUpload)
        const imgs = (Array.isArray(uploaded) ? uploaded : []).filter((f) => String(f?.kind || '') === 'image' && f?.url)
        setDraft((d) => {
          const prev = Array.isArray(d?.media) ? d.media : []
          return { ...d, media: [...prev, ...imgs].slice(0, 3) }
        })
      } catch (err) {
        setProofError(err?.response?.data?.message ?? err?.message ?? 'Failed to upload')
      } finally {
        setUploadingProof(false)
      }
    }

    return (
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">{kindLabel(draft.kind)}</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => onDelete(e)}
              className="border-red-200 text-red-700 hover:bg-red-50"
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor={`re_title_${e.id}`}>{draft.kind === 'experience' ? 'Job title' : 'Title'}</Label>
            <Input id={`re_title_${e.id}`} value={draft.title ?? ''} onChange={(ev) => setDraft((d) => ({ ...d, title: ev.target.value }))} />
          </div>
          <div>
            <Label htmlFor={`re_org_${e.id}`}>{draft.kind === 'education' ? 'School' : 'Organization'}</Label>
            <Input id={`re_org_${e.id}`} value={draft.org_name ?? ''} onChange={(ev) => setDraft((d) => ({ ...d, org_name: ev.target.value }))} />
          </div>
          <div>
            <Label htmlFor={`re_field_${e.id}`}>{draft.kind === 'education' ? 'Field of study' : 'Field (optional)'}</Label>
            <Input id={`re_field_${e.id}`} value={draft.field ?? ''} onChange={(ev) => setDraft((d) => ({ ...d, field: ev.target.value }))} />
          </div>
          <div>
            <Label htmlFor={`re_location_${e.id}`}>Location (optional)</Label>
            <Input
              id={`re_location_${e.id}`}
              value={draft.location ?? ''}
              onChange={(ev) => setDraft((d) => ({ ...d, location: ev.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor={`re_start_${e.id}`}>Start date</Label>
            <Input
              id={`re_start_${e.id}`}
              type="date"
              value={normalizeDateOnly(draft.start_date)}
              onChange={(ev) => setDraft((d) => ({ ...d, start_date: ev.target.value || null }))}
            />
          </div>
          <div>
            <Label htmlFor={`re_end_${e.id}`}>End date (optional)</Label>
            <Input
              id={`re_end_${e.id}`}
              type="date"
              value={normalizeDateOnly(draft.end_date)}
              onChange={(ev) => setDraft((d) => ({ ...d, end_date: ev.target.value || null }))}
            />
          </div>
        </div>

        <div className="mt-3">
          <Label htmlFor={`re_desc_${e.id}`}>Description (optional)</Label>
          <textarea
            id={`re_desc_${e.id}`}
            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            rows={3}
            value={draft.description ?? ''}
            onChange={(ev) => setDraft((d) => ({ ...d, description: ev.target.value }))}
          />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor={`re_url_${e.id}`}>Link (optional)</Label>
            <Input id={`re_url_${e.id}`} value={draft.url ?? ''} onChange={(ev) => setDraft((d) => ({ ...d, url: ev.target.value || null }))} />
          </div>
          <div>
            <Label htmlFor={`re_sort_${e.id}`}>Sort order</Label>
            <Input
              id={`re_sort_${e.id}`}
              type="number"
              min="0"
              value={draft.sort_order ?? 0}
              onChange={(ev) => setDraft((d) => ({ ...d, sort_order: Number(ev.target.value ?? 0) }))}
            />
          </div>
        </div>

        {canAttachProof ? (
          <div className="mt-4">
            <Label>Proof images (optional)</Label>
            <div className="mt-1 text-xs text-slate-600">Upload up to 3 images (certificate, qualification, ID card of the institution, etc.).</div>

            {media.length ? (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {media.map((m, idx) => (
                  <div key={`${m?.url || idx}`} className="relative overflow-hidden rounded-2xl border bg-white">
                    <a href={m?.url} target="_blank" rel="noreferrer" title="Open image">
                      <img src={m?.thumb_url || m?.url} alt="proof" className="h-24 w-full object-cover" loading="lazy" />
                    </a>
                    <button
                      type="button"
                      disabled={uploadingProof || saving}
                      onClick={() => setDraft((d) => ({ ...d, media: (Array.isArray(d?.media) ? d.media : []).filter((_, i) => i !== idx) }))}
                      className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white hover:bg-black/70"
                      aria-label="Remove image"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingProof || saving || media.length >= 3}
                onChange={(ev) => {
                  addProofImages(ev.target.files)
                  // allow uploading the same file again if needed
                  ev.target.value = ''
                }}
                className="block w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-2 text-sm"
              />
              <div className="text-xs text-slate-600">
                {uploadingProof ? 'Uploading…' : media.length ? `${media.length}/3 uploaded` : 'No images yet'}
              </div>
            </div>
            {proofError ? <div className="mt-2 text-sm text-red-700">{proofError}</div> : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" disabled={saving} onClick={() => onUpdate(e, draft)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setDraft({ ...e })}>
            Reset
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Array.from(byKind.entries()).map(([kind, list]) => (
        <Card key={kind}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">{kindLabel(kind)}</div>
            <Button type="button" variant="secondary" onClick={() => onCreate(kind)}>
              Add
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {list.length ? (
              list.map((e) => <EntryForm key={e.id} e={e} />)
            ) : (
              <div className="text-sm text-slate-600">No entries yet.</div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

function LinkRow({ value, onChange, onRemove }) {
  return (
    <div className="grid gap-2 md:grid-cols-6">
      <div className="md:col-span-2">
        <Input value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} placeholder="Label" />
      </div>
      <div className="md:col-span-3">
        <Input value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://…" />
      </div>
      <div className="md:col-span-1">
        <Button type="button" variant="secondary" onClick={onRemove} className="w-full">
          Remove
        </Button>
      </div>
    </div>
  )
}

function PostComposer({ onPost }) {
  const toast = useToast()
  const { user } = useAuth()
  const { online } = useOnlineStatus()
  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const draftKey = useMemo(() => `draft:posts:composer:${user?.id ?? 'unknown'}`, [user?.id])
  const draft = useDraftAutosave({
    key: draftKey,
    data: { text, saved_at: Date.now() },
    enabled: true,
    debounceMs: 650,
  })

  useEffect(() => {
    if (text) return
    const d = draft.load()
    if (!d?.text) return
    setText(String(d.text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previews = useMemo(() => {
    return files.map((f) => ({
      name: f.name,
      kind: f.type?.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(f),
    }))
  }, [files])

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url)
    }
  }, [previews])

  async function submit(e) {
    e.preventDefault()
    if (!online) {
      const msg = 'You are offline. Your draft is saved — reconnect to post.'
      setError(msg)
      toast.warning('Offline', msg)
      return
    }
    setBusy(true)
    setError(null)
    try {
      let media = null
      if (files.length) {
        const uploaded = await uploadMediaFiles(files)
        media = uploaded.map((x) => ({ url: x.url, kind: x.kind, mime: x.mime, size: x.size }))
      }
      const body = text.trim()
      if (!body && (!media || !media.length)) {
        setError('Write something or attach media.')
        return
      }
      await http.post('/posts', { body, media })
      setText('')
      setFiles([])
      draft.clear()
      await onPost()
    } catch (e2) {
      setError(e2?.response?.data?.message ?? e2?.message ?? 'Failed to post')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="text-sm font-semibold">Create post</div>
        <div className="text-xs text-slate-500">
          {draft.savedAt ? <span className="text-emerald-700">Draft saved</span> : <span>Draft not saved yet</span>}
        </div>
      </div>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          rows={3}
          placeholder="Share an update, photos of your work, before/after…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <div>
          <Input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            disabled={busy}
          />
          <div className="mt-2 text-xs text-slate-500">Images/videos supported. Max 50MB per file.</div>
        </div>
        {previews.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {previews.map((p) => (
              <div key={p.url} className="overflow-hidden rounded-2xl border bg-white">
                {p.kind === 'video' ? (
                  <video src={p.url} controls className="h-48 w-full object-cover" />
                ) : (
                  <img src={p.url} alt={p.name} className="h-48 w-full object-cover" loading="lazy" />
                )}
                <div className="px-3 py-2 text-xs text-slate-600">{p.name}</div>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <div className="text-sm text-red-700">{error}</div> : null}
        <div className="flex gap-2">
          <Button disabled={busy}>{busy ? 'Posting…' : 'Post'}</Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setText('')
              setFiles([])
              setError(null)
              draft.clear()
            }}
          >
            Clear
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PostCard({ post, onRefresh, viewerId }) {
  const toast = useToast()
  const COMMENTS_PAGE_SIZE = 100

  const [busyLike, setBusyLike] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsOffset, setCommentsOffset] = useState(0)
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [busyMoreComments, setBusyMoreComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [busyComment, setBusyComment] = useState(false)
  const [busyCommentLikeId, setBusyCommentLikeId] = useState(null)
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [busyReply, setBusyReply] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [busyEditId, setBusyEditId] = useState(null)
  const [busyDeleteCommentId, setBusyDeleteCommentId] = useState(null)
  const [expandedThreads, setExpandedThreads] = useState(() => new Set())
  const [busyReportId, setBusyReportId] = useState(null)
  const [likersOpen, setLikersOpen] = useState(false)

  const media = Array.isArray(post?.media) ? post.media : []
  const authorId = post?.user_id ?? null
  const authorTo = authorId ? (viewerId && authorId === viewerId ? '/profile' : `/u/${authorId}`) : null

  async function toggleLike() {
    setBusyLike(true)
    try {
      if (post.viewer_liked) await http.delete(`/posts/${post.id}/like`)
      else await http.post(`/posts/${post.id}/like`)
      await onRefresh()
    } finally {
      setBusyLike(false)
    }
  }

  async function loadComments({ reset } = {}) {
    const doReset = !!reset
    const offset = doReset ? 0 : commentsOffset
    if (!doReset) setBusyMoreComments(true)
    try {
      const res = await http.get(`/posts/${post.id}/comments?limit=${COMMENTS_PAGE_SIZE}&offset=${offset}`)
      const data = res.data
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
      if (doReset) {
        const auto = new Set()
        const byId = new Map(items.map((c) => [c?.id, c]).filter((x) => x[0]))
        const rootMemo = new Map()
        const rootOf = (id) => {
          if (!id) return null
          if (rootMemo.has(id)) return rootMemo.get(id)
          const c = byId.get(id)
          const pid = c?.parent_id ? String(c.parent_id) : null
          if (!pid) {
            rootMemo.set(id, id)
            return id
          }
          if (pid === id) {
            rootMemo.set(id, id)
            return id
          }
          const r = rootOf(pid) || id
          rootMemo.set(id, r)
          return r
        }
        for (const c of items) {
          if (c?.parent_id != null) continue
          const rc = Number(c?.reply_count ?? 0)
          if (rc > 0 && rc <= 1) auto.add(c.id)
          if (viewerId && c?.user_id && String(c.user_id) === String(viewerId) && rc > 0) auto.add(c.id)
        }
        if (viewerId) {
          for (const c of items) {
            if (!c?.id) continue
            if (!c?.user_id || String(c.user_id) !== String(viewerId)) continue
            const rid = rootOf(c.id)
            if (rid) auto.add(rid)
          }
        }
        setExpandedThreads(auto)
      }
      setComments((prev) => {
        if (doReset) return items
        const cur = Array.isArray(prev) ? prev : []
        const seen = new Set(cur.map((x) => x?.id).filter(Boolean))
        const merged = [...cur]
        for (const it of items) {
          const id = it?.id
          if (!id || seen.has(id)) continue
          seen.add(id)
          merged.push(it)
        }
        return merged
      })
      const nextOffset = typeof data?.nextOffset === 'number' ? data.nextOffset : offset + (typeof data?.rootsReturned === 'number' ? data.rootsReturned : 0)
      setCommentsOffset(nextOffset)
      setCommentsHasMore(Boolean(data?.hasMore))
    } finally {
      if (!doReset) setBusyMoreComments(false)
    }
  }

  async function toggleComments() {
    const next = !commentsOpen
    setCommentsOpen(next)
    if (next) {
      setComments([])
      setCommentsOffset(0)
      setCommentsHasMore(false)
      setReplyingToId(null)
      setReplyText('')
      setEditingId(null)
      setEditText('')
      setExpandedThreads(new Set())
      await loadComments({ reset: true })
    }
  }

  async function submitComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    setBusyComment(true)
    try {
      await http.post(`/posts/${post.id}/comments`, { body: commentText.trim() })
      setCommentText('')
      await loadComments({ reset: true })
      await onRefresh()
    } finally {
      setBusyComment(false)
    }
  }

  async function toggleCommentLike(c) {
    const id = c?.id
    if (!id) return
    setBusyCommentLikeId(id)
    try {
      if (c.viewer_liked) await http.delete(`/posts/comments/${id}/like`)
      else await http.post(`/posts/comments/${id}/like`)
      await loadComments({ reset: true })
    } finally {
      setBusyCommentLikeId(null)
    }
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!replyingToId) return
    if (!replyText.trim()) return
    setBusyReply(true)
    try {
      await http.post(`/posts/${post.id}/comments`, { body: replyText.trim(), parent_id: replyingToId })
      setReplyText('')
      setReplyingToId(null)
      await loadComments({ reset: true })
      await onRefresh()
    } finally {
      setBusyReply(false)
    }
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editingId) return
    const body = String(editText || '').trim()
    if (!body) return
    setBusyEditId(editingId)
    try {
      await http.put(`/posts/comments/${editingId}`, { body })
      setEditingId(null)
      setEditText('')
      await loadComments({ reset: true })
    } finally {
      setBusyEditId(null)
    }
  }

  async function deleteComment(id) {
    if (!id) return
    const ok = window.confirm('Delete this comment?')
    if (!ok) return
    setBusyDeleteCommentId(id)
    try {
      await http.delete(`/posts/comments/${id}`)
      setEditingId(null)
      setEditText('')
      setReplyingToId(null)
      setReplyText('')
      await loadComments({ reset: true })
      await onRefresh()
    } finally {
      setBusyDeleteCommentId(null)
    }
  }

  async function reportComment(id) {
    if (!id) return
    const reason = window.prompt('Why are you reporting this comment? (e.g., spam, harassment, scam)')
    if (!reason || !String(reason).trim()) return
    const details = window.prompt('Any extra details? (optional)') || ''
    setBusyReportId(id)
    try {
      await http.post(`/posts/comments/${id}/report`, { reason: String(reason).trim(), details: details.trim() || null })
      toast.push({ title: 'Reported', description: 'Thanks — our team will review it.', variant: 'success' })
    } catch (e) {
      toast.push({ title: e?.response?.data?.message ?? e?.message ?? 'Failed to report', variant: 'error' })
    } finally {
      setBusyReportId(null)
    }
  }

  const thread = useMemo(() => {
    const src = Array.isArray(comments) ? comments : []
    const byParent = new Map()
    for (const c of src) {
      const pid = c?.parent_id ?? null
      if (!byParent.has(pid)) byParent.set(pid, [])
      byParent.get(pid).push(c)
    }
    return {
      roots: byParent.get(null) ?? [],
      repliesById: byParent,
    }
  }, [comments])

  function renderCommentNode(c, depth) {
    const id = c?.id ?? null
    if (!id) return null

    const isDeleted = !!c?.is_deleted
    const cid = c?.user_id ?? null
    const to = !isDeleted && cid ? (viewerId && String(cid) === String(viewerId) ? '/profile' : `/u/${cid}`) : null
    const canEdit = !isDeleted && viewerId && cid && String(cid) === String(viewerId)
    const canReport = !isDeleted && viewerId && cid && String(cid) !== String(viewerId)
    const isEditing = editingId === id
    const isReplying = replyingToId === id
    const isLiking = busyCommentLikeId === id
    const likeCount = isDeleted ? 0 : Number(c?.like_count ?? 0)
    const children = thread.repliesById.get(id) ?? []
    const replyCount = Number(c?.reply_count ?? 0)
    const isExpanded = expandedThreads.has(id)

    const createdLabel = c?.created_at ? new Date(c.created_at).toLocaleString() : ''
    const edited =
      !isDeleted &&
      c?.updated_at &&
      c?.created_at &&
      Math.abs(new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) > 60_000
    const editedLabel = edited ? ` • edited ${new Date(c.updated_at).toLocaleString()}` : ''

    return (
      <div key={id} className="space-y-2" style={{ marginLeft: depth ? depth * 18 : 0 }}>
        <div className={`rounded-xl border p-3 ${depth === 0 ? 'bg-slate-50' : 'bg-white'}`}>
          <div className="flex items-center gap-2">
            {to ? (
              <Link to={to} className="shrink-0">
                <img src={c?.author_profile_pic || '/locallink-logo.png'} alt="avatar" className="h-7 w-7 rounded-xl border object-cover" />
              </Link>
            ) : (
              <img src={c?.author_profile_pic || '/locallink-logo.png'} alt="avatar" className="h-7 w-7 rounded-xl border object-cover" />
            )}
            {isDeleted ? (
              <div className="text-xs font-semibold text-slate-500">Deleted</div>
            ) : to ? (
              <Link to={to} className="text-xs font-semibold text-slate-800 hover:underline">
                {c?.author_name || 'User'}
              </Link>
            ) : (
              <div className="text-xs font-semibold text-slate-800">{c?.author_name || 'User'}</div>
            )}
            <div className="ml-auto text-[11px] text-slate-500">
              {createdLabel}
              {editedLabel}
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={saveEdit} className="mt-2 flex gap-2">
              <Input value={editText} onChange={(e) => setEditText(e.target.value)} placeholder="Edit your comment…" />
              <Button disabled={busyEditId === id}>{busyEditId === id ? '…' : 'Save'}</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyEditId === id}
                onClick={() => {
                  setEditingId(null)
                  setEditText('')
                }}
              >
                Cancel
              </Button>
            </form>
          ) : (
            <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{isDeleted ? '[deleted]' : c?.body}</div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={isDeleted || isLiking}
              onClick={() => toggleCommentLike(c)}
              className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {c?.viewer_liked ? 'Unlike' : 'Like'}
              {!isDeleted && likeCount ? ` (${likeCount})` : ''}
            </button>
            {replyCount > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedThreads((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100"
              >
                {isExpanded ? 'Hide replies' : `View replies (${replyCount})`}
              </button>
            ) : null}
            <button
              type="button"
              disabled={isDeleted}
              onClick={() => {
                setEditingId(null)
                setEditText('')
                setExpandedThreads((prev) => new Set(prev).add(id))
                setReplyingToId((prev) => (prev === id ? null : id))
                setReplyText('')
              }}
              className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              title={isDeleted ? 'Cannot reply to deleted comment' : undefined}
            >
              Reply
            </button>
            {canEdit ? (
              <>
                <button
                  type="button"
                  disabled={busyDeleteCommentId === id}
                  onClick={() => {
                    setReplyingToId(null)
                    setReplyText('')
                    setEditingId(id)
                    setEditText(String(c?.body || ''))
                  }}
                  className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busyDeleteCommentId === id}
                  onClick={() => deleteComment(id)}
                  className="rounded-full border border-red-200 bg-white px-3 py-1 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {busyDeleteCommentId === id ? 'Deleting…' : 'Delete'}
                </button>
              </>
            ) : null}
            {canReport ? (
              <button
                type="button"
                disabled={busyReportId === id}
                onClick={() => reportComment(id)}
                className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {busyReportId === id ? 'Reporting…' : 'Report'}
              </button>
            ) : null}
          </div>

          {isReplying ? (
            <form onSubmit={submitReply} className="mt-2 flex gap-2">
              <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply…" />
              <Button disabled={busyReply}>{busyReply ? '…' : 'Reply'}</Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busyReply}
                onClick={() => {
                  setReplyingToId(null)
                  setReplyText('')
                }}
              >
                Cancel
              </Button>
            </form>
          ) : null}
        </div>

        {children.length && isExpanded ? children.map((ch) => renderCommentNode(ch, depth + 1)) : null}
      </div>
    )
  }

  async function del() {
    const ok = window.confirm('Delete this post?')
    if (!ok) return
    setBusyDelete(true)
    try {
      await http.delete(`/posts/${post.id}`)
      await onRefresh()
    } finally {
      setBusyDelete(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {authorTo ? (
            <Link to={authorTo} className="shrink-0">
              <img
                src={post?.author_profile_pic || '/locallink-logo.png'}
                alt="avatar"
                className="h-10 w-10 rounded-2xl border object-cover"
              />
            </Link>
          ) : (
            <img
              src={post?.author_profile_pic || '/locallink-logo.png'}
              alt="avatar"
              className="h-10 w-10 rounded-2xl border object-cover"
            />
          )}
          <div>
            {authorTo ? (
              <Link to={authorTo} className="text-sm font-semibold text-slate-900 hover:underline">
                {post?.author_name || 'User'}
              </Link>
            ) : (
              <div className="text-sm font-semibold text-slate-900">{post?.author_name || 'User'}</div>
            )}
            <div className="text-xs text-slate-500">{post?.created_at ? new Date(post.created_at).toLocaleString() : ''}</div>
          </div>
        </div>
        <Button variant="secondary" disabled={busyDelete} onClick={del} title="Delete post">
          {busyDelete ? 'Deleting…' : 'Delete'}
        </Button>
      </div>

      {post?.body ? <div className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{post.body}</div> : null}

      {media.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {media.slice(0, 6).map((m) => (
            <div key={m.url} className="overflow-hidden rounded-2xl border bg-white">
              {m.kind === 'video' ? (
                <video src={m.url} controls className="h-56 w-full object-cover" />
              ) : (
                <img src={m.url} alt="post media" className="h-56 w-full object-cover" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-slate-600">
          <button
            type="button"
            onClick={() => setLikersOpen(true)}
            className={
              Number(post?.like_count ?? 0) > 0
                ? 'font-medium text-slate-700 hover:text-slate-900 hover:underline'
                : 'cursor-default'
            }
            disabled={Number(post?.like_count ?? 0) < 1}
          >
            {Number(post?.like_count ?? 0)} likes
          </button>
          {' • '}
          {Number(post?.comment_count ?? 0)} comments
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={busyLike} onClick={toggleLike}>
            {post.viewer_liked ? 'Unlike' : 'Like'}
          </Button>
          <Button variant="secondary" onClick={toggleComments}>
            {commentsOpen ? 'Hide comments' : 'Comments'}
          </Button>
        </div>
      </div>

      <LikersModal open={likersOpen} onClose={() => setLikersOpen(false)} postId={post?.id} />

      {commentsOpen ? (
        <div className="mt-3 space-y-3">
          <form onSubmit={submitComment} className="flex gap-2">
            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" />
            <Button disabled={busyComment}>{busyComment ? '…' : 'Send'}</Button>
          </form>
          {thread.roots.length ? (
            <div className="space-y-2">
              {thread.roots.map((c) => renderCommentNode(c, 0))}
            </div>
          ) : (
            <div className="text-sm text-slate-600">No comments yet.</div>
          )}
          {commentsHasMore ? (
            <div className="pt-1">
              <Button variant="secondary" disabled={busyMoreComments} onClick={() => loadComments()}>
                {busyMoreComments ? 'Loading…' : 'Load more comments'}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

export function MyProfile() {
  const { user, setSession, token } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [me, setMe] = useState(null)
  const [trust, setTrust] = useState(null)
  const [trustLoading, setTrustLoading] = useState(true)
  const [trustError, setTrustError] = useState(null)
  const [roleProfile, setRoleProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profilePic, setProfilePic] = useState('') // url
  const [photoFile, setPhotoFile] = useState(null)
  const [coverPhoto, setCoverPhoto] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [crop, setCrop] = useState(null) // { kind: 'profile' | 'cover', file: File }
  const [mediaBusy, setMediaBusy] = useState(null) // 'profile' | 'cover' | null
  const [bio, setBio] = useState('')
  const [links, setLinks] = useState([{ label: 'Website', url: '' }])

  // artisan fields
  const [skills, setSkills] = useState('')
  const [primarySkill, setPrimarySkill] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [jobCategories, setJobCategories] = useState([]) // job categories I serve (Events & Catering, Domestic Services, etc.)

  // farmer fields
  const [farmLocation, setFarmLocation] = useState('')
  const [farmPlaceId, setFarmPlaceId] = useState('')
  const [farmLat, setFarmLat] = useState(null)
  const [farmLng, setFarmLng] = useState(null)
  const [farmType, setFarmType] = useState('')

  // verification
  const [verificationInfo, setVerificationInfo] = useState(null)
  const [requestedLevel, setRequestedLevel] = useState('bronze')
  const [verificationNote, setVerificationNote] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [verificationBusy, setVerificationBusy] = useState(false)

  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(null)
  const [searchParams] = useSearchParams()
  const tabFromUrl = (searchParams.get('tab') || '').trim().toLowerCase()
  const initialTab = ['posts', 'about', 'resume', 'settings'].includes(tabFromUrl) ? tabFromUrl : 'posts'
  const [tab, setTab] = useState(initialTab) // posts | about | settings

  const coverPickerRef = useRef(null)
  const profilePickerRef = useRef(null)
  const verificationPickerRef = useRef(null)

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState(null)

  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(null)
  const [historyBusy, setHistoryBusy] = useState(false)

  const [endorse, setEndorse] = useState(null)
  const [endorseLoading, setEndorseLoading] = useState(true)
  const [endorseError, setEndorseError] = useState(null)

  const [badges, setBadges] = useState(null)
  const [badgesLoading, setBadgesLoading] = useState(true)
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [badgesFocusKey, setBadgesFocusKey] = useState(null)

  const [followCounts, setFollowCounts] = useState(null) // {followers, following}
  const [privateProfile, setPrivateProfile] = useState(false)
  const [followRequests, setFollowRequests] = useState([])
  const [followRequestsLoading, setFollowRequestsLoading] = useState(false)
  const [followRequestsBusyId, setFollowRequestsBusyId] = useState(null)

  const role = user?.role

  const canEditRole = role === 'artisan' || role === 'farmer' || role === 'driver'

  const [resume, setResume] = useState([])
  const [resumeLoading, setResumeLoading] = useState(true)
  const [resumeError, setResumeError] = useState(null)
  const [resumeBusyId, setResumeBusyId] = useState(null)
  const profileStrength = useMemo(() => {
    const items = []
    let score = 0
    const add = (ok, points, missing) => {
      if (ok) score += points
      else if (missing) items.push(missing)
    }

    add(!!profilePic, 15, { key: 'pic', title: 'Add a profile photo', tab: 'settings' })
    add(!!coverPhoto, 10, { key: 'cover', title: 'Add a cover photo', tab: 'settings' })
    add(!!String(bio || '').trim(), 15, { key: 'bio', title: 'Write a short bio', tab: 'about' })
    add((Array.isArray(links) ? links : []).some((l) => l?.label && l?.url), 10, { key: 'links', title: 'Add at least 1 link', tab: 'about' })
    add((Array.isArray(resume) ? resume : []).length > 0, 20, { key: 'resume', title: 'Add 1 resume entry', tab: 'resume' })
    add(
      (Array.isArray(posts) ? posts : []).some((p) => Array.isArray(p?.media) && p.media.some((m) => m?.url)),
      20,
      { key: 'post', title: 'Post 1 photo/video of your work', tab: 'posts' },
    )

    const role = String(me?.role || '')
    if (role === 'artisan') add(!!String(serviceArea || '').trim(), 10, { key: 'location', title: 'Add your service area', tab: 'settings' })
    else if (role === 'farmer') add(!!String(farmLocation || '').trim(), 10, { key: 'location', title: 'Add your farm location', tab: 'settings' })

    const percent = Math.max(0, Math.min(100, Math.round(score)))
    return { percent, missing: items }
  }, [bio, coverPhoto, farmLocation, links, me?.role, posts, profilePic, resume, serviceArea])

  // Account deletion (intentionally "hard to delete")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState(1) // 1=before-you-go, 2=confirm, 3=final
  const [deleteReason, setDeleteReason] = useState('taking_a_break')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [deleteSuccess, setDeleteSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setTrustLoading(true)
      setTrustError(null)
      setHistoryLoading(true)
      setHistoryError(null)
      setEndorseLoading(true)
      setEndorseError(null)
      setBadgesLoading(true)
      try {
        const [res, profRes, trustRes, histRes, endRes, bdgRes, reqRes] = await Promise.all([
          http.get('/me'),
          http.get('/profile/me').catch(() => ({ data: null })),
          http.get('/trust/me').catch(() => ({ data: null })),
          http.get('/profile/me/history?limit=12&offset=0').catch(() => ({ data: null })),
          http.get('/endorsements/me?limit=10').catch(() => ({ data: null })),
          http.get('/profile/me/badges').catch(() => ({ data: null })),
          http.get('/follows/requests/incoming').catch(() => ({ data: [] })),
        ])
        const u = res.data
        const profile = profRes.data?.profile ?? null
        if (cancelled) return
        setMe(u)
        setTrust(trustRes.data ?? null)
        setHistory(histRes.data ?? null)
        setEndorse(endRes.data ?? null)
        setBadges(bdgRes.data ?? null)
        setName(u?.name ?? '')
        setPhone(u?.phone ?? '')
        setProfilePic(u?.profile_pic ?? '')
        setCoverPhoto(profile?.cover_photo ?? '')
        setBio(profile?.bio ?? '')
        const l = Array.isArray(profile?.links) ? profile.links : []
        setLinks(l.length ? l : [{ label: 'Website', url: '' }])
        setPrivateProfile(Boolean(profile?.private_profile))
        setFollowRequests(Array.isArray(reqRes.data) ? reqRes.data : [])

        if (role === 'artisan') {
          const ap = await http.get('/artisans/me')
          if (cancelled) return
          setRoleProfile(ap.data)
          setSkills((ap.data?.skills ?? []).join(', '))
          setPrimarySkill(
            ap.data?.primary_skill ??
              (Array.isArray(ap.data?.skills) ? ap.data.skills.filter(Boolean)[0] : '') ??
              '',
          )
          setExperienceYears(ap.data?.experience_years != null ? String(ap.data.experience_years) : '')
          setServiceArea(ap.data?.service_area ?? '')
          setJobCategories(Array.isArray(ap.data?.job_categories) ? ap.data.job_categories : [])
        }
        if (role === 'farmer') {
          const fp = await http.get('/farmers/me')
          if (cancelled) return
          setRoleProfile(fp.data)
          setFarmLocation(fp.data?.farm_location ?? '')
          setFarmPlaceId(fp.data?.farm_place_id ?? '')
          setFarmLat(fp.data?.farm_lat != null ? Number(fp.data.farm_lat) : null)
          setFarmLng(fp.data?.farm_lng != null ? Number(fp.data.farm_lng) : null)
          setFarmType((fp.data?.farm_type ?? []).join(', '))
        }

        const v = await http.get('/verification/me').catch(() => ({ data: null }))
        if (cancelled) return
        setVerificationInfo(v.data)
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load profile')
          setTrustError(err?.response?.data?.message ?? err?.message ?? null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setTrustLoading(false)
          setHistoryLoading(false)
          setEndorseLoading(false)
          setBadgesLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [role])

  async function refreshFollowRequests() {
    setFollowRequestsLoading(true)
    try {
      const r = await http.get('/follows/requests/incoming')
      setFollowRequests(Array.isArray(r.data) ? r.data : [])
    } catch {
      setFollowRequests([])
    } finally {
      setFollowRequestsLoading(false)
    }
  }

  async function acceptFollowRequest(row) {
    const fid = row?.id
    if (!fid) return
    setFollowRequestsBusyId(fid)
    try {
      await http.post(`/follows/requests/${encodeURIComponent(fid)}/accept`)
      toast.success('Accepted', 'You approved the follow request.')
      await refreshFollowRequests()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed')
    } finally {
      setFollowRequestsBusyId(null)
    }
  }

  async function declineFollowRequest(row) {
    const fid = row?.id
    if (!fid) return
    setFollowRequestsBusyId(fid)
    try {
      await http.delete(`/follows/requests/${encodeURIComponent(fid)}`)
      toast.success('Declined')
      await refreshFollowRequests()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed')
    } finally {
      setFollowRequestsBusyId(null)
    }
  }

  // UX: when user selects/crops a profile/cover photo, auto-save immediately (no extra "Save" click).
  async function autoSaveMedia(kind, file) {
    if (!file) return
    if (mediaBusy) return
    setMediaBusy(kind)
    setSaved(null)
    setError(null)
    try {
      const uploaded = await uploadMediaFiles([file])
      const url = uploaded?.[0]?.url ?? null
      if (!url) throw new Error('Upload failed')

      if (kind === 'profile') {
        const meRes = await http.put('/me', { profile_pic: url })
        const updatedUser = meRes.data
        setMe(updatedUser)
        setProfilePic(updatedUser?.profile_pic ?? url)
        if (token) setSession(token, { ...(user ?? {}), ...updatedUser })
        setPhotoFile(null)
        toast.success('Profile photo updated.')
      } else if (kind === 'cover') {
        const prof = await http.put('/profile/me', { cover_photo: url })
        setCoverPhoto(prof.data?.cover_photo ?? url)
        setCoverFile(null)
        toast.success('Cover photo updated.')
      }
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to update photo'
      setError(msg)
      toast.error(msg)
      // Keep selected file as fallback so user can retry by pressing Save.
    } finally {
      setMediaBusy(null)
    }
  }

  async function loadMoreHistory() {
    if (historyBusy) return
    setHistoryBusy(true)
    setHistoryError(null)
    try {
      const offset = Array.isArray(history?.items) ? history.items.length : 0
      const r = await http.get(`/profile/me/history?limit=12&offset=${offset}`)
      const next = r.data ?? null
      setHistory((prev) => {
        const prevItems = Array.isArray(prev?.items) ? prev.items : []
        const nextItems = Array.isArray(next?.items) ? next.items : []
        return { ...(next ?? prev ?? {}), summary: next?.summary ?? prev?.summary ?? null, items: [...prevItems, ...nextItems] }
      })
    } catch (e) {
      setHistoryError(e?.response?.data?.message ?? e?.message ?? 'Failed to load work history')
    } finally {
      setHistoryBusy(false)
    }
  }

  // Use stable object URLs and revoke them to avoid memory leaks.
  const previewPic = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : profilePic || null), [photoFile, profilePic])
  const previewCover = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : coverPhoto || null), [coverFile, coverPhoto])
  const roleDisplay = useMemo(() => {
    const r = String(me?.role || '')
    if (r === 'artisan') {
      const v =
        String(primarySkill || '').trim() ||
        String(skills || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)[0] ||
        'Artisan'
      return titleCaseWords(v)
    }
    if (!r) return ''
    return r.toUpperCase()
  }, [me?.role, primarySkill, skills])
  useEffect(() => {
    if (!photoFile || !previewPic?.startsWith?.('blob:')) return
    return () => URL.revokeObjectURL(previewPic)
  }, [photoFile, previewPic])
  useEffect(() => {
    if (!coverFile || !previewCover?.startsWith?.('blob:')) return
    return () => URL.revokeObjectURL(previewCover)
  }, [coverFile, previewCover])

  async function loadPosts() {
    setPostsLoading(true)
    setPostsError(null)
    try {
      const r = await http.get('/posts/me')
      setPosts(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setPostsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load posts')
    } finally {
      setPostsLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCounts() {
      try {
        const r = await http.get('/follows/me')
        if (!cancelled) setFollowCounts(r.data ?? null)
      } catch {
        if (!cancelled) setFollowCounts(null)
      }
    }
    loadCounts()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadResume() {
    setResumeLoading(true)
    setResumeError(null)
    try {
      const r = await http.get('/profile/me/resume')
      setResume(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setResumeError(e?.response?.data?.message ?? e?.message ?? 'Failed to load resume')
    } finally {
      setResumeLoading(false)
    }
  }

  useEffect(() => {
    loadResume()
  }, [])

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setSaved(null)
    setError(null)
    try {
      let nextProfilePic = profilePic || null
      if (photoFile) {
        const uploaded = await uploadMediaFiles([photoFile])
        nextProfilePic = uploaded?.[0]?.url ?? nextProfilePic
      }
      let nextCoverPhoto = coverPhoto || null
      if (coverFile) {
        const uploaded = await uploadMediaFiles([coverFile])
        nextCoverPhoto = uploaded?.[0]?.url ?? nextCoverPhoto
      }

      const meRes = await http.put('/me', {
        name,
        phone: phone || null,
        profile_pic: nextProfilePic || null,
      })
      const updatedUser = meRes.data
      setMe(updatedUser)
      setProfilePic(updatedUser?.profile_pic ?? '')
      setPhotoFile(null)

      // Update AuthContext user so header shows correct name/pic immediately
      if (token) setSession(token, { ...(user ?? {}), ...updatedUser })

      const cleanedLinks = (Array.isArray(links) ? links : [])
        .map((l) => ({ label: String(l.label || '').trim(), url: String(l.url || '').trim() }))
        .filter((l) => l.label && l.url)
        .slice(0, 8)

      const prof = await http.put('/profile/me', {
        bio: bio || null,
        cover_photo: nextCoverPhoto || null,
        links: cleanedLinks.length ? cleanedLinks : null,
        private_profile: privateProfile,
      })
      setCoverPhoto(prof.data?.cover_photo ?? nextCoverPhoto ?? '')
      setBio(prof.data?.bio ?? bio)
      setLinks(cleanedLinks.length ? cleanedLinks : [{ label: 'Website', url: '' }])
      setCoverFile(null)

      if (role === 'artisan') {
        const body = {
          primary_skill: String(primarySkill || '').trim() || null,
          skills: skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          experience_years: experienceYears ? Number(experienceYears) : null,
          service_area: serviceArea || null,
          job_categories: Array.isArray(jobCategories) && jobCategories.length ? jobCategories : null,
        }
        const ap = await http.post('/artisans/me', body)
        setRoleProfile(ap.data)
      }

      if (role === 'farmer') {
        const body = {
          farm_location: farmLocation || null,
          farm_place_id: farmPlaceId || null,
          farm_lat: farmLat != null ? Number(farmLat) : null,
          farm_lng: farmLng != null ? Number(farmLng) : null,
          farm_type: farmType
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
        const fp = await http.post('/farmers/me', body)
        setRoleProfile(fp.data)
      }

      setSaved('Saved.')
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ImageCropperModal
        open={!!crop}
        file={crop?.file ?? null}
        title={crop?.kind === 'cover' ? 'Adjust cover photo' : 'Adjust profile photo'}
        aspect={crop?.kind === 'cover' ? 3 : 1}
        outputMaxWidth={crop?.kind === 'cover' ? 1600 : 800}
        onCancel={() => setCrop(null)}
        onConfirm={(croppedFile) => {
          if (crop?.kind === 'cover') {
            setCoverFile(croppedFile)
            autoSaveMedia('cover', croppedFile)
          } else {
            setPhotoFile(croppedFile)
            autoSaveMedia('profile', croppedFile)
          }
          setCrop(null)
        }}
      />

      {/* Always-mounted pickers so the header can trigger uploads (Facebook-style). */}
      <input
        ref={coverPickerRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ''
          if (!f) return
          setCrop({ kind: 'cover', file: f })
        }}
        disabled={busy}
      />
      <input
        ref={profilePickerRef}
        className="sr-only"
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null
          e.target.value = ''
          if (!f) return
          setCrop({ kind: 'profile', file: f })
        }}
        disabled={busy}
      />
      <input
        ref={verificationPickerRef}
        className="sr-only"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []))}
        disabled={verificationBusy}
      />

      <VerifyAccountBanner />

      <div className="overflow-hidden rounded-3xl border bg-white">
        <div className="relative h-48 bg-slate-200">
          {previewCover ? (
            <img src={previewCover} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-emerald-400 via-lime-300 to-orange-300" />
          )}
          {/* Subtle overlay so icons/edges stay readable on any cover photo */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/50" />
          {/* Facebook-style: click cover to change */}
          <button
            type="button"
            disabled={busy}
            onClick={() => coverPickerRef.current?.click?.()}
            className="absolute inset-0 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Change cover photo"
            title={busy ? 'Saving…' : 'Change cover photo'}
          />
          <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            Change cover
          </div>
        </div>
        <div className="px-6 pb-5 pt-0">
          {/* Twitter/Facebook style header: avatar + name on a solid card (not directly on the cover) */}
          <div className="-mt-12 relative z-10 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => profilePickerRef.current?.click?.()}
                className="relative h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-sm disabled:cursor-not-allowed"
                aria-label="Change profile photo"
                title={busy ? 'Saving…' : 'Change profile photo'}
              >
                <img src={previewPic || '/locallink-logo.png'} alt="Profile" className="h-full w-full object-cover" />
                <div className="absolute bottom-1 right-1 rounded-full border border-white/30 bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  Edit
                </div>
              </button>
              <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <div className="text-xl font-bold text-slate-900 md:text-2xl">{me?.name || 'My Profile'}</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  <span className="font-semibold">{roleDisplay}</span>
                  <span className="mx-2">•</span>
                  Rating {Number(me?.rating ?? 0).toFixed(1)}
                </div>
                {followCounts ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                    <span className="rounded-full border bg-white px-3 py-1 font-semibold">
                      {Number(followCounts.followers ?? 0)} followers
                    </span>
                    <span className="rounded-full border bg-white px-3 py-1 font-semibold">
                      {Number(followCounts.following ?? 0)} following
                    </span>
                    <Link to="/feed" className="rounded-full border bg-white px-3 py-1 font-semibold text-emerald-700 hover:underline">
                      View feed
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => setTab('posts')}>
                Posts
              </Button>
              <Button variant="secondary" type="button" onClick={() => setTab('about')}>
                About
              </Button>
              <Button variant="secondary" type="button" onClick={() => setTab('resume')}>
                Resume
              </Button>
              <Button variant="secondary" type="button" onClick={() => setTab('settings')}>
                Edit profile
              </Button>
            </div>
          </div>

          <div className="mt-4 max-w-2xl">
            {bio ? (
              <div className="text-sm text-slate-800 whitespace-pre-wrap">{bio}</div>
            ) : (
              <div className="text-sm text-slate-600">Add a bio to help people trust you.</div>
            )}
            {Array.isArray(links) && links.filter((l) => l?.label && l?.url).length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {links
                  .filter((l) => l?.label && l?.url)
                  .slice(0, 6)
                  .map((l) => (
                    <a
                      key={`${l.label}-${l.url}`}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                      {l.label}
                    </a>
                  ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">Public profile:</div>
            <Link to={`/u/${encodeURIComponent(me?.id || user?.id || '')}`}>
              <Button variant="secondary">View as public</Button>
            </Link>
          </div>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Profile strength</div>
                <div className="mt-1 text-sm text-slate-700">
                  Completeness: <span className="font-semibold">{profileStrength.percent}%</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" type="button" onClick={() => setTab('settings')}>
                  Edit profile
                </Button>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-500" style={{ width: `${profileStrength.percent}%` }} />
            </div>
            {profileStrength.missing.length ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-700">Quick improvements</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileStrength.missing.slice(0, 6).map((m) => (
                    <Button key={m.key} variant="secondary" type="button" onClick={() => setTab(m.tab)}>
                      {m.title}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-600">Great—your profile looks complete.</div>
            )}
          </Card>

          {me?.referral_code ? (
            <Card>
              <div className="text-sm font-semibold">Invite friends</div>
              <div className="mt-2 text-sm text-slate-700">
                Share your referral link. When someone signs up with it and completes their first job, you get credit.
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${me.referral_code}` : me.referral_code}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const url = typeof window !== 'undefined' ? `${window.location.origin}/register?ref=${me.referral_code}` : ''
                    if (url && navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(url)
                      toast.success('Referral link copied.')
                    }
                  }}
                >
                  Copy link
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">Your code: <span className="font-mono font-semibold">{me.referral_code}</span></div>
            </Card>
          ) : null}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Trust</div>
                {trustLoading ? (
                  <div className="mt-1 text-sm text-slate-600">Loading trust…</div>
                ) : trustError ? (
                  <div className="mt-1 text-sm text-red-700">{trustError}</div>
                ) : trust ? (
                  <div className="mt-1 text-sm text-slate-700">
                    Trust level: <span className="font-semibold">{String(trust.band || 'low').toUpperCase()}</span>{' '}
                    <span className="text-slate-400">•</span> Score:{' '}
                    <span className="font-semibold">{Number(trust.score ?? 0).toFixed(1)}</span>/100
                  </div>
                ) : (
                  <div className="mt-1 text-sm text-slate-600">No trust report available.</div>
                )}
                {!badgesLoading ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ExperienceBadgesRow
                      badges={badges?.badges ?? []}
                      max={6}
                      onBadgeClick={(b) => {
                        setBadgesFocusKey(b?.key ?? null)
                        setBadgesOpen(true)
                      }}
                    />
                    {Array.isArray(badges?.badges) && badges.badges.length ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setBadgesFocusKey(null)
                          setBadgesOpen(true)
                        }}
                      >
                        View all badges
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link to="/trust/verification">
                  <Button variant="secondary">How verification works</Button>
                </Link>
                <Link to="/trust/escrow">
                  <Button variant="secondary">How escrow works</Button>
                </Link>
              </div>
            </div>

            {trust?.risk_flags?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {trust.risk_flags.slice(0, 6).map((f) => (
                  <span key={f.key} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {f.label}
                  </span>
                ))}
              </div>
            ) : null}

            {trust?.how_to_improve?.length ? (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-700">How to improve trust</div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {trust.how_to_improve.slice(0, 6).map((a) => (
                    <div key={a.key} className="rounded-2xl border bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                      <div className="mt-1 text-sm text-slate-700">{a.body}</div>
                      {a.cta_url ? (
                        <div className="mt-2">
                          <Link to={a.cta_url}>
                            <Button variant="secondary">Do this</Button>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-600">Keep completing transactions and responding quickly to grow your trust.</div>
            )}
          </Card>

          <ExperienceBadgesModal
            open={badgesOpen}
            onClose={() => setBadgesOpen(false)}
            title="Your badges"
            badges={badges?.badges ?? []}
            computedAt={badges?.computed_at ?? null}
            initialKey={badgesFocusKey}
          />

          {tab === 'resume' ? (
            resumeLoading ? (
              <Card>Loading resume…</Card>
            ) : resumeError ? (
              <Card>
                <div className="text-sm text-red-700">{resumeError}</div>
              </Card>
            ) : (
              <ResumeEditor
                entries={resume}
                busyId={resumeBusyId}
                onCreate={async (kind) => {
                  try {
                    setResumeBusyId('create')
                    await http.post('/profile/me/resume', { kind, title: '', org_name: '', sort_order: 0 })
                    await loadResume()
                  } catch (e) {
                    const issues = e?.response?.data?.issues
                    const issue0 = Array.isArray(issues) && issues[0] ? `${issues[0].path?.join('.') || 'field'}: ${issues[0].message}` : null
                    setResumeError(issue0 ?? e?.response?.data?.message ?? e?.message ?? 'Failed to create entry')
                  } finally {
                    setResumeBusyId(null)
                  }
                }}
                onUpdate={async (entry, draft) => {
                  try {
                    setResumeBusyId(entry.id)
                    await http.put(`/profile/me/resume/${entry.id}`, draft)
                    await loadResume()
                  } catch (e) {
                    const issues = e?.response?.data?.issues
                    const issue0 = Array.isArray(issues) && issues[0] ? `${issues[0].path?.join('.') || 'field'}: ${issues[0].message}` : null
                    setResumeError(issue0 ?? e?.response?.data?.message ?? e?.message ?? 'Failed to save entry')
                  } finally {
                    setResumeBusyId(null)
                  }
                }}
                onDelete={async (entry) => {
                  const ok = window.confirm('Delete this resume entry?')
                  if (!ok) return
                  try {
                    setResumeBusyId(entry.id)
                    await http.delete(`/profile/me/resume/${entry.id}`)
                    await loadResume()
                  } catch (e) {
                    setResumeError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete entry')
                  } finally {
                    setResumeBusyId(null)
                  }
                }}
              />
            )
          ) : tab === 'posts' ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-1">
                <Card>
                  <div className="text-sm font-semibold">About</div>
                  <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{bio || 'No bio yet.'}</div>
                  <div className="mt-3 text-xs text-slate-500">{me?.email}</div>
                </Card>
                <WorkHistoryCard
                  loading={historyLoading}
                  error={historyError}
                  data={history}
                  onLoadMore={loadMoreHistory}
                  loadMoreBusy={historyBusy}
                  compact
                />
                <SkillEndorsementsCard loading={endorseLoading} error={endorseError} data={endorse} compact />
              </div>
              <div className="space-y-4 lg:col-span-2">
                <PostComposer onPost={loadPosts} />
                {postsLoading ? (
                  <Card>Loading posts…</Card>
                ) : postsError ? (
                  <Card>
                    <div className="text-sm text-red-700">{postsError}</div>
                  </Card>
                ) : posts.length === 0 ? (
                  <Card>
                    <div className="text-sm text-slate-600">No posts yet. Share your first photo or update.</div>
                  </Card>
                ) : (
                  posts.map((p) => <PostCard key={p.id} post={p} onRefresh={loadPosts} viewerId={me?.id ?? user?.id ?? null} />)
                )}
              </div>
            </div>
          ) : tab === 'about' ? (
        <form onSubmit={save} className="space-y-6">
              <Card>
                <div className="text-sm font-semibold">Bio</div>
                <textarea
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  rows={5}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people who you are, what you do, and where you work…"
                />
              </Card>
              <Card>
                <div className="text-sm font-semibold">Links</div>
                <div className="mt-3 space-y-2">
                  {links.map((l, idx) => (
                    <LinkRow
                      key={idx}
                      value={l}
                      onChange={(next) => setLinks((arr) => arr.map((x, i) => (i === idx ? next : x)))}
                      onRemove={() => setLinks((arr) => arr.filter((_, i) => i !== idx))}
                    />
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLinks((arr) => [...arr, { label: '', url: '' }])}
                    disabled={links.length >= 8}
                  >
                    Add link
                  </Button>
                </div>
                <div className="mt-2 text-xs text-slate-500">Examples: Instagram, WhatsApp business link, portfolio, Google Maps.</div>
              </Card>
              <Card>
                <div className="text-sm font-semibold">Cover photo</div>
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => coverPickerRef.current?.click?.()}
                    >
                      Choose cover photo
                    </Button>
                    {coverFile ? <div className="text-xs text-slate-600">{coverFile.name}</div> : null}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Recommended: a wide photo of your work (before/after).</div>
                </div>
              </Card>

              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {saved ? <div className="text-sm text-emerald-700">{saved}</div> : null}
              <Button disabled={busy}>{busy ? 'Saving…' : 'Save about'}</Button>
            </form>
          ) : (
            <form onSubmit={save} className="space-y-6">
              <Card>
                <div className="text-sm font-semibold">Privacy</div>
                <label className="mt-3 flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={privateProfile}
                    onChange={(e) => setPrivateProfile(e.target.checked)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Private profile (follow approval required)</div>
                    <div className="mt-1 text-sm text-slate-700">
                      When enabled, people must request to follow you and you must approve before they can view your profile content.
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Tip: keep this OFF for business discovery; turn it ON for personal/social privacy.</div>
                  </div>
                </label>
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Follow requests</div>
                  <Button variant="secondary" type="button" size="sm" onClick={refreshFollowRequests} disabled={followRequestsLoading}>
                    {followRequestsLoading ? 'Refreshing…' : 'Refresh'}
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {followRequestsLoading && followRequests.length === 0 ? (
                    <div className="text-sm text-slate-600">Loading…</div>
                  ) : followRequests.length === 0 ? (
                    <div className="text-sm text-slate-600">No pending requests.</div>
                  ) : (
                    followRequests.slice(0, 30).map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <img src={r?.profile_pic || '/locallink-logo.png'} alt="avatar" className="h-10 w-10 rounded-2xl border object-cover" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{r?.name || 'User'}</div>
                            <div className="mt-0.5 text-xs text-slate-500">{String(r?.role || '').toUpperCase()}</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" disabled={followRequestsBusyId === r.id} onClick={() => acceptFollowRequest(r)}>
                            {followRequestsBusyId === r.id ? 'Working…' : 'Accept'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={followRequestsBusyId === r.id}
                            onClick={() => declineFollowRequest(r)}
                          >
                            Decline
                          </Button>
                          <Link to={`/u/${encodeURIComponent(r.id)}`}>
                            <Button type="button" size="sm" variant="secondary">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

          <Card>
            <div className="text-sm font-semibold">Basic info</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233…" />
              </div>
            </div>
                {role === 'artisan' ? (
                  <div className="mt-4">
                    <Label>Profession (e.g., Electrician)</Label>
                    <Input value={primarySkill} onChange={(e) => setPrimarySkill(e.target.value)} placeholder="Electrician, Plumber, Mason…" />
                    <div className="mt-1 text-xs text-slate-500">This is what people will see instead of “Artisan”.</div>
                  </div>
                ) : null}

            <div className="mt-4">
              <Label>Profile photo</Label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => profilePickerRef.current?.click?.()}
                    >
                      Choose profile photo
                    </Button>
                    {photoFile ? <div className="text-xs text-slate-600">{photoFile.name}</div> : null}
                  </div>
                  {previewPic ? (
                    <img src={previewPic} alt="Profile" className="mt-3 h-28 w-28 rounded-2xl border object-cover" />
                  ) : null}
            </div>
          </Card>

          {role === 'artisan' ? (
            <Card>
              <div className="text-sm font-semibold">Artisan profile</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Skills (comma separated)</Label>
                  <Input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Plumbing, Electrical, Masonry" />
                </div>
                <div>
                  <Label>Experience (years)</Label>
                  <Input
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    type="number"
                    min="0"
                    placeholder="e.g. 5"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label>Service area</Label>
                <Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Accra, Tema" />
              </div>
              <div className="mt-4">
                <Label>Job categories I serve</Label>
                <div className="mt-2 text-xs text-slate-500">Select the types of jobs you do (e.g. Events & Catering, Domestic Services). Helps buyers find you.</div>
                <div className="mt-2 flex flex-wrap gap-3">
                  {JOB_CATEGORIES_TIER1.map((c) => {
                    const checked = Array.isArray(jobCategories) && jobCategories.includes(c)
                    return (
                      <label key={c} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setJobCategories((prev) =>
                              checked ? (prev || []).filter((x) => x !== c) : [...(prev || []), c],
                            )
                          }}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700">{c}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </Card>
          ) : null}

          {role === 'farmer' ? (
            <Card>
              {(() => {
                const vertical = getStoredFarmerVertical()
                const isFlorist = vertical === 'florist'
                return (
                  <>
              <div className="text-sm font-semibold">{getFarmerVerticalLabel(vertical)} profile</div>
              <div className="mt-4">
                <Label>{isFlorist ? 'Store location' : 'Farm location'}</Label>
                <LocationInput
                  value={farmLocation}
                  onChange={(v) => {
                    setFarmLocation(v)
                    // If user types manually, keep existing geo unless they pick a place
                  }}
                  onPick={({ placeId, lat, lng }) => {
                    setFarmPlaceId(placeId || '')
                    setFarmLat(lat ?? null)
                    setFarmLng(lng ?? null)
                  }}
                  disabled={busy}
                />
                {farmLat != null && farmLng != null ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Saved coordinates: {Number(farmLat).toFixed(5)}, {Number(farmLng).toFixed(5)}
                  </div>
                ) : null}
              </div>
              <div className="mt-4">
                <Label>{isFlorist ? 'Product types (comma separated)' : 'Farm type (comma separated)'}</Label>
                <Input value={farmType} onChange={(e) => setFarmType(e.target.value)} placeholder={isFlorist ? 'Roses, Lilies, Bouquets' : 'Vegetables, Fruits, Poultry'} />
              </div>
                  </>
                )
              })()}
            </Card>
          ) : null}

          {(role === 'artisan' || role === 'farmer' || role === 'driver') ? (
            <Card>
              <div className="text-sm font-semibold">Verification</div>
              <div className="mt-2 text-sm text-slate-700">
                Current level:{' '}
                <span className="font-semibold">{verificationInfo?.current_level ? String(verificationInfo.current_level) : 'unverified'}</span>
              </div>
              {verificationInfo?.latest_request ? (
                <div className="mt-1 text-xs text-slate-600">
                  Latest request: {verificationInfo.latest_request.requested_level} • status: {verificationInfo.latest_request.status}
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-600">No requests yet.</div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Request level</Label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={requestedLevel}
                    onChange={(e) => setRequestedLevel(e.target.value)}
                    disabled={verificationBusy}
                  >
                    <option value="bronze">Bronze (ID + phone)</option>
                    <option value="silver">Silver (references + photos)</option>
                    <option value="gold">Gold (physical verification)</option>
                  </select>
                </div>
                <div>
                  <Label>Evidence photos (optional)</Label>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                    disabled={verificationBusy}
                      onClick={() => verificationPickerRef.current?.click?.()}
                    >
                      Choose files
                    </Button>
                    {evidenceFiles.length ? <div className="text-xs text-slate-600">{evidenceFiles.length} file(s) selected</div> : null}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Label>Note (optional)</Label>
                <Input
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  placeholder="Add any details for the admin review (e.g. ‘ID uploaded’, ‘references available’)"
                  disabled={verificationBusy}
                />
              </div>

              <div className="mt-4">
                <Button
                  type="button"
                  disabled={verificationBusy}
                  onClick={async () => {
                    setVerificationBusy(true)
                    setError(null)
                    try {
                      const uploaded = await uploadMediaFiles(evidenceFiles)
                      const uploadedUrls = uploaded.map((x) => x.url).filter(Boolean)
                      await http.post('/verification/request', {
                        requested_level: requestedLevel,
                        note: verificationNote || null,
                        evidence: uploadedUrls.length ? { files: uploadedUrls } : null,
                      })
                      const v = await http.get('/verification/me')
                      setVerificationInfo(v.data)
                      setEvidenceFiles([])
                      setVerificationNote('')
                    } catch (err) {
                      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to submit verification request')
                    } finally {
                      setVerificationBusy(false)
                    }
                  }}
                >
                  {verificationBusy ? 'Submitting…' : 'Submit verification request'}
                </Button>
                <div className="mt-2 text-xs text-slate-500">
                  Admin will review your evidence and approve/reject. Your verification affects trust and visibility.
                </div>
              </div>
            </Card>
          ) : null}

          {!canEditRole ? (
            <Card>
              <div className="text-sm text-slate-600">Your role does not have extra profile fields yet.</div>
            </Card>
          ) : null}

              <Card className="border-red-200">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Account</div>
                    <div className="mt-1 text-sm text-slate-600">
                      You can delete your account, but LocalLink won’t allow deletion while you have an active dispute.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDeleteOpen(true)
                      setDeleteStep(1)
                      setDeleteReason('taking_a_break')
                      setDeleteConfirm('')
                      setDeleteError(null)
                      setDeleteSuccess(false)
                    }}
                  >
                    Delete account…
                  </Button>
                </div>

                {deleteOpen ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                    {deleteStep === 1 ? (
                      <>
                        <div className="text-sm font-semibold text-red-900">Before you go</div>
                        <div className="mt-2 text-sm text-red-800">
                          Most people don’t want to lose their public profile link and reviews. Try one of these first:
                        </div>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-800">
                          <li>Update your profile links so customers can contact you.</li>
                          <li>Take a break (notifications controls coming soon).</li>
                          <li>If something went wrong, message support via the Contact page.</li>
                        </ul>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                            Keep my account
                          </Button>
                          <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={() => setDeleteStep(2)}>
                            Continue to delete
                          </Button>
                        </div>
                      </>
                    ) : deleteStep === 2 ? (
                      <>
                        <div className="text-sm font-semibold text-red-900">Confirm deletion</div>
                        <div className="mt-2 text-sm text-red-800">
                          Choose a reason (helps us improve). Then type <span className="font-semibold">DELETE</span>.
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <Label htmlFor="delete_reason">Reason</Label>
                            <select
                              id="delete_reason"
                              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                              value={deleteReason}
                              onChange={(e) => setDeleteReason(e.target.value)}
                              disabled={deleteBusy}
                            >
                              <option value="taking_a_break">I’m taking a break</option>
                              <option value="not_useful">I didn’t find it useful</option>
                              <option value="privacy_concerns">Privacy concerns</option>
                              <option value="too_expensive">It’s too expensive</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <Label htmlFor="delete_confirm">Type DELETE</Label>
                            <Input
                              id="delete_confirm"
                              value={deleteConfirm}
                              onChange={(e) => setDeleteConfirm(e.target.value)}
                              disabled={deleteBusy}
                            />
                          </div>
                        </div>
                        {deleteError ? <div className="mt-3 text-sm text-red-800">{deleteError}</div> : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" onClick={() => setDeleteStep(1)} disabled={deleteBusy}>
                            Back
                          </Button>
                          <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={() => setDeleteStep(3)} disabled={deleteBusy}>
                            Continue
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-red-900">Final step</div>
                        <div className="mt-2 text-sm text-red-800">
                          This will remove your public profile and log you out. If you have any active disputes, deletion will be blocked.
                        </div>
                        {deleteSuccess ? (
                          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                            Account deleted. Redirecting…
                          </div>
                        ) : null}
                        {deleteError ? <div className="mt-3 text-sm text-red-800">{deleteError}</div> : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button type="button" variant="secondary" onClick={() => setDeleteStep(2)} disabled={deleteBusy}>
                            Back
                          </Button>
                          <Button
                            type="button"
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteBusy}
                            onClick={async () => {
                              setDeleteBusy(true)
                              setDeleteError(null)
                              try {
                                const res = await http.post('/me/delete', { confirm: deleteConfirm, reason: deleteReason })
                                if (!res?.data?.ok) throw new Error('Delete failed')
                                setDeleteSuccess(true)
                                setSession(null, null)
                                setTimeout(() => navigate('/', { replace: true }), 800)
                              } catch (e) {
                                setDeleteError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete account')
                              } finally {
                                setDeleteBusy(false)
                              }
                            }}
                          >
                            {deleteBusy ? 'Deleting…' : 'Permanently delete account'}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            {saved ? <div className="text-sm text-emerald-700">{saved}</div> : null}
            {roleProfile ? (
              <div className="text-xs text-slate-500">
                Updated: {new Date(roleProfile.updated_at ?? me?.updated_at ?? Date.now()).toLocaleString()}
              </div>
            ) : null}
          </div>
        </form>
          )}
        </>
      )}
    </div>
  )
}


