import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LikersModal } from './LikersModal.jsx'
import { http } from '../../api/http.js'
import { Button, Card, Input } from '../ui/FormControls.jsx'
import { useToast } from '../ui/Toast.jsx'

function LinkedPostBlock({ type, related }) {
  const id = related?.id
  if (!id) return null
  if (type === 'produce') {
    const name = related?.name ?? 'Product'
    const price = related?.price != null ? `GH₵ ${Number(related.price).toLocaleString()}` : null
    const imageUrl = related?.image_url
    const to = `/marketplace/products/${encodeURIComponent(id)}`
    return (
      <Link to={to} className="mt-3 flex gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 p-3 hover:bg-slate-100/80">
        {imageUrl ? <img src={imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-xl bg-slate-200" />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{name}</div>
          {related?.category ? <div className="text-xs text-slate-600">{related.category}</div> : null}
          {price ? <div className="mt-0.5 text-sm font-medium text-emerald-700">{price}</div> : null}
          <span className="mt-2 inline-block rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Buy</span>
        </div>
      </Link>
    )
  }
  if (type === 'job') {
    const title = related?.title ?? 'Job'
    const budget = related?.budget != null ? `GH₵ ${Number(related.budget).toLocaleString()}` : null
    const to = `/jobs/${encodeURIComponent(id)}`
    return (
      <Link to={to} className="mt-3 block rounded-2xl border border-slate-200 bg-amber-50/80 p-3 hover:bg-amber-100/80">
        <div className="font-semibold text-slate-900">{title}</div>
        {related?.category ? <div className="text-xs text-slate-600">{related.category}</div> : null}
        {budget ? <div className="mt-0.5 text-sm font-medium text-amber-800">{budget}</div> : null}
        <span className="mt-2 inline-block rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">View job</span>
      </Link>
    )
  }
  if (type === 'service') {
    const title = related?.title ?? 'Service'
    const price = related?.price != null ? `GH₵ ${Number(related.price).toLocaleString()}` : null
    const to = `/buyer/jobs/new?service=${encodeURIComponent(id)}`
    return (
      <Link to={to} className="mt-3 block rounded-2xl border border-slate-200 bg-blue-50/80 p-3 hover:bg-blue-100/80">
        <div className="font-semibold text-slate-900">{title}</div>
        {related?.category ? <div className="text-xs text-slate-600">{related.category}</div> : null}
        {price ? <div className="mt-0.5 text-sm font-medium text-blue-800">{price}</div> : null}
        <span className="mt-2 inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Book</span>
      </Link>
    )
  }
  if (type === 'job_post') {
    const title = related?.title ?? 'Job'
    const payMin = related?.pay_min != null ? Number(related.pay_min) : null
    const payMax = related?.pay_max != null ? Number(related.pay_max) : null
    const period = related?.pay_period ?? 'month'
    const payLabel =
      payMin != null && payMax != null
        ? `GHS ${payMin.toLocaleString()}${payMin === payMax ? '' : `–${payMax.toLocaleString()}`}/${period}`
        : payMin != null
          ? `GHS ${payMin.toLocaleString()}/${period}`
          : null
    const to = '/jobs'
    return (
      <Link to={to} className="relative mt-3 block rounded-2xl border border-amber-200 bg-amber-50/80 p-3 hover:bg-amber-100/80">
        {payLabel ? (
          <span className="absolute right-3 top-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
            {payLabel}
          </span>
        ) : null}
        <div className="font-semibold text-slate-900 pr-24">{title}</div>
        {related?.location ? <div className="text-xs text-slate-600">{related.location}</div> : null}
        <span className="mt-2 inline-block rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Apply now</span>
      </Link>
    )
  }
  return null
}

export function SocialPostCard({ post, viewerId, onRefresh }) {
  const toast = useToast()
  const COMMENTS_PAGE_SIZE = 100
  const canInteract = Boolean(viewerId)

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
  const [busyBoost, setBusyBoost] = useState(false)

  const media = Array.isArray(post?.media) ? post.media : []
  const authorId = post?.user_id ?? null
  const authorTo = authorId
    ? viewerId && authorId === viewerId
      ? '/profile'
      : `/u/${encodeURIComponent(authorId)}`
    : null
  const canDelete = viewerId && authorId && String(viewerId) === String(authorId)
  const canBoost = canDelete && post?.type && ['job', 'service', 'job_post'].includes(post.type)
  const isSponsored = Boolean(post?.sponsored)

  function openLikers() {
    if (Number(post?.like_count ?? 0) < 1) return
    setLikersOpen(true)
  }

  async function toggleLike() {
    if (!canInteract) return toast.warning('Login required', 'Please login to like posts.')
    setBusyLike(true)
    try {
      if (post.viewer_liked) await http.delete(`/posts/${post.id}/like`)
      else await http.post(`/posts/${post.id}/like`)
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to like')
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
          // Guard against malformed cycles.
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
        // Auto-expand threads you've participated in anywhere in the subtree.
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
      const nextOffset =
        typeof data?.nextOffset === 'number' ? data.nextOffset : offset + (typeof data?.rootsReturned === 'number' ? data.rootsReturned : 0)
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
    if (!canInteract) return toast.warning('Login required', 'Please login to comment.')
    if (!commentText.trim()) return
    setBusyComment(true)
    try {
      await http.post(`/posts/${post.id}/comments`, { body: commentText.trim() })
      setCommentText('')
      await loadComments({ reset: true })
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to comment')
    } finally {
      setBusyComment(false)
    }
  }

  async function toggleCommentLike(c) {
    if (!canInteract) return toast.warning('Login required', 'Please login to like comments.')
    const id = c?.id
    if (!id) return
    setBusyCommentLikeId(id)
    try {
      if (c.viewer_liked) await http.delete(`/posts/comments/${id}/like`)
      else await http.post(`/posts/comments/${id}/like`)
      await loadComments({ reset: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to like comment')
    } finally {
      setBusyCommentLikeId(null)
    }
  }

  async function submitReply(e) {
    e.preventDefault()
    if (!canInteract) return toast.warning('Login required', 'Please login to reply.')
    if (!replyingToId) return
    if (!replyText.trim()) return
    setBusyReply(true)
    try {
      await http.post(`/posts/${post.id}/comments`, { body: replyText.trim(), parent_id: replyingToId })
      setReplyText('')
      setReplyingToId(null)
      await loadComments({ reset: true })
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to reply')
    } finally {
      setBusyReply(false)
    }
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!canInteract) return toast.warning('Login required', 'Please login to edit.')
    if (!editingId) return
    const body = String(editText || '').trim()
    if (!body) return
    setBusyEditId(editingId)
    try {
      await http.put(`/posts/comments/${editingId}`, { body })
      setEditingId(null)
      setEditText('')
      await loadComments({ reset: true })
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to edit')
    } finally {
      setBusyEditId(null)
    }
  }

  async function deleteComment(id) {
    if (!canInteract) return toast.warning('Login required', 'Please login to delete.')
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
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete comment')
    } finally {
      setBusyDeleteCommentId(null)
    }
  }

  async function reportComment(id) {
    if (!canInteract) return toast.warning('Login required', 'Please login to report.')
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
                title={isExpanded ? 'Hide replies' : 'View replies'}
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
              title={isDeleted ? 'Cannot reply to deleted comment' : 'Reply'}
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
                title="Report this comment"
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
    if (!canInteract) return toast.warning('Login required', 'Please login to delete.')
    const ok = window.confirm('Delete this post?')
    if (!ok) return
    setBusyDelete(true)
    try {
      await http.delete(`/posts/${post.id}`)
      toast.success('Post deleted.')
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete')
    } finally {
      setBusyDelete(false)
    }
  }

  async function toggleBoost() {
    if (!canBoost) return
    setBusyBoost(true)
    try {
      await http.patch(`/posts/${post.id}`, { sponsored: !isSponsored })
      toast.success(isSponsored ? 'Post unboosted.' : 'Post boosted — it will appear higher in the feed.')
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to update')
    } finally {
      setBusyBoost(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {authorTo ? (
            <Link to={authorTo} className="shrink-0">
              <img src={post?.author_profile_pic || '/locallink-logo.png'} alt="avatar" className="h-10 w-10 rounded-2xl border object-cover" />
            </Link>
          ) : (
            <img src={post?.author_profile_pic || '/locallink-logo.png'} alt="avatar" className="h-10 w-10 rounded-2xl border object-cover" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {authorTo ? (
                <Link to={authorTo} className="text-sm font-semibold text-slate-900 hover:underline">
                  {post?.author_name || 'User'}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-slate-900">{post?.author_name || 'User'}</span>
              )}
              {isSponsored ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Sponsored</span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500">{post?.created_at ? new Date(post.created_at).toLocaleString() : ''}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canBoost ? (
            <Button
              variant="secondary"
              disabled={busyBoost}
              onClick={toggleBoost}
              title={isSponsored ? 'Remove boost' : 'Boost this post so it appears higher in the feed'}
            >
              {busyBoost ? '…' : isSponsored ? 'Unboost' : 'Boost'}
            </Button>
          ) : null}
          {canDelete ? (
            <Button variant="secondary" disabled={busyDelete} onClick={del} title="Delete post">
              {busyDelete ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </div>
      </div>

      {post?.body ? <div className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{post.body}</div> : null}

      {/* Marketplace linked post: produce / job / service with CTA */}
      {post?.type && post.type !== 'update' && post?.related?.id ? (
        <LinkedPostBlock type={post.type} related={post.related} />
      ) : null}

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
            onClick={openLikers}
            className={
              Number(post?.like_count ?? 0) > 0
                ? 'font-medium text-slate-700 hover:text-slate-900 hover:underline'
                : 'cursor-default'
            }
            disabled={Number(post?.like_count ?? 0) < 1}
          >
            {Number(post?.like_count ?? 0)} reactions
          </button>
          {' · '}
          <button
            type="button"
            onClick={toggleComments}
            className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
          >
            {Number(post?.comment_count ?? 0)} Comments
          </button>
          {' · '}
          <button
            type="button"
            className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
            onClick={() => {
              const url = window.location.origin + window.location.pathname + '?post=' + (post?.id ?? '')
              navigator.clipboard?.writeText(url).then(() => {}, () => {})
            }}
          >
            Share
          </button>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={busyLike} onClick={toggleLike}>
            {post.viewer_liked ? 'Unlike' : 'Like'}
          </Button>
          <Button variant="secondary" size="sm" onClick={toggleComments}>
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

