import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { LikersModal } from './LikersModal.jsx'
import { http, resolveUploadUrl } from '../../api/http.js'
import { Button, Input } from '../ui/FormControls.jsx'
import { useToast } from '../ui/Toast.jsx'
import { ConfirmModal } from '../ui/Modal.jsx'

function formatTimeAgo(date) {
  const now = Date.now()
  const diff = now - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

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

function PostMediaItem({ media, single, gridSpan }) {
  const [imgError, setImgError] = useState(false)
  const url = resolveUploadUrl(media?.url)
  const isVideo = media?.kind === 'video'
  const wrapperClass = single ? 'rounded-none' : gridSpan === 2 ? 'col-span-2' : ''
  const imgClass = single ? 'max-h-[400px]' : 'h-48'

  if (!url) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-stone-100 ${wrapperClass} ${single ? '' : 'min-h-[12rem]'}`}>
        <div className="flex flex-col items-center gap-2 py-8 text-stone-400">
          <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
          <span className="text-xs font-medium">Image unavailable</span>
        </div>
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className={`overflow-hidden bg-stone-100 ${wrapperClass}`}>
        <video src={url} controls className="h-64 w-full object-cover" />
      </div>
    )
  }

  if (imgError) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-stone-100 ${wrapperClass} ${single ? 'min-h-[200px]' : 'h-48'}`}>
        <div className="flex flex-col items-center gap-2 py-6 text-stone-400">
          <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
          <span className="text-xs font-medium">Image unavailable</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`overflow-hidden bg-stone-100 ${wrapperClass}`}>
      <img
        src={url}
        alt=""
        className={`w-full object-cover ${imgClass}`}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    </div>
  )
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
  const [confirmDeletePost, setConfirmDeletePost] = useState(false)
  const [confirmDeleteCommentId, setConfirmDeleteCommentId] = useState(null)

  const [optimisticLiked, setOptimisticLiked] = useState(null)
  const [optimisticLikeCount, setOptimisticLikeCount] = useState(null)

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

  const isLiked = optimisticLiked ?? post.viewer_liked
  const displayLikeCount = optimisticLikeCount ?? Number(post?.like_count ?? 0)

  const toggleLike = useCallback(async () => {
    if (!canInteract) return toast.warning('Login required', 'Please login to like posts.')
    const wasLiked = optimisticLiked ?? post.viewer_liked
    const prevCount = optimisticLikeCount ?? Number(post?.like_count ?? 0)
    setOptimisticLiked(!wasLiked)
    setOptimisticLikeCount(wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1)
    setBusyLike(true)
    try {
      if (wasLiked) await http.delete(`/posts/${post.id}/like`)
      else await http.post(`/posts/${post.id}/like`)
      await onRefresh?.()
      setOptimisticLiked(null)
      setOptimisticLikeCount(null)
    } catch (e) {
      setOptimisticLiked(wasLiked)
      setOptimisticLikeCount(prevCount)
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to like')
    } finally {
      setBusyLike(false)
    }
  }, [canInteract, optimisticLiked, optimisticLikeCount, post, toast, onRefresh])

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

  async function doDeleteComment(id) {
    if (!id) return
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
      setConfirmDeleteCommentId(null)
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
                  onClick={() => setConfirmDeleteCommentId(id)}
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

  async function doDeletePost() {
    setBusyDelete(true)
    try {
      await http.delete(`/posts/${post.id}`)
      toast.success('Post deleted.')
      await onRefresh?.()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete')
    } finally {
      setBusyDelete(false)
      setConfirmDeletePost(false)
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

  const roleLabel = post?.author_role ? String(post.author_role).charAt(0).toUpperCase() + String(post.author_role).slice(1) : ''
  const timeAgo = post?.created_at ? formatTimeAgo(new Date(post.created_at)) : ''
  const likeCount = displayLikeCount
  const commentCount = Number(post?.comment_count ?? 0)
  const reactionEmoji = likeCount > 50 ? '🔥' : likeCount > 10 ? '❤️' : '👍'

  return (
    <div className="animate-slide-up rounded-2xl border border-stone-200/60 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-0">
        <div className="flex items-center gap-3">
          {authorTo ? (
            <Link to={authorTo} className="shrink-0">
              <img src={post?.author_profile_pic || '/locallink-logo.png'} alt="" className="h-11 w-11 rounded-full border-2 border-stone-100 object-cover" />
            </Link>
          ) : (
            <img src={post?.author_profile_pic || '/locallink-logo.png'} alt="" className="h-11 w-11 rounded-full border-2 border-stone-100 object-cover" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {authorTo ? (
                <Link to={authorTo} className="text-sm font-bold text-stone-900 hover:underline">
                  {post?.author_name || 'User'}
                </Link>
              ) : (
                <span className="text-sm font-bold text-stone-900">{post?.author_name || 'User'}</span>
              )}
              {roleLabel ? (
                <span className="text-[11px] text-stone-500">• {roleLabel}</span>
              ) : null}
              {isSponsored ? (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Sponsored</span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
              <span>{timeAgo}</span>
              {post?.author_company_slug ? (
                <>
                  <span>•</span>
                  <Link to={`/c/${post.author_company_slug}`} className="text-emerald-600 hover:underline">{post.author_company_slug}</Link>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canBoost ? (
            <button type="button" disabled={busyBoost} onClick={toggleBoost} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50" title={isSponsored ? 'Remove boost' : 'Boost'}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" disabled={busyDelete} onClick={() => setConfirmDeletePost(true)} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-red-500 disabled:opacity-50" title="Delete">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Body */}
      {post?.body ? <div className="mt-2 whitespace-pre-wrap px-5 text-[14px] leading-relaxed text-stone-800">{post.body}</div> : null}

      {post?.type && post.type !== 'update' && post?.related?.id ? (
        <div className="px-5"><LinkedPostBlock type={post.type} related={post.related} /></div>
      ) : null}

      {/* Media */}
      {media.length ? (
        <div className={`mt-3 ${media.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'}`}>
          {media.slice(0, 4).map((m, idx) => (
            <PostMediaItem
              key={`${m.url}-${idx}`}
              media={m}
              single={media.length === 1}
              gridSpan={media.length > 2 && idx === 0 ? 2 : 1}
            />
          ))}
        </div>
      ) : null}

      {/* Reactions bar */}
      <div className="flex items-center justify-between px-5 py-2">
        <div className="flex items-center gap-1.5 text-[13px] text-stone-500">
          {likeCount > 0 ? (
            <button type="button" onClick={openLikers} className="flex items-center gap-1 hover:underline">
              <span>{reactionEmoji}</span>
              <span className="font-medium">{likeCount}</span>
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[12px] text-stone-400">
          {commentCount > 0 ? (
            <button type="button" onClick={toggleComments} className="hover:underline">
              💬 {commentCount} Comments
            </button>
          ) : null}
          <button
            type="button"
            className="hover:underline"
            onClick={() => {
              const url = window.location.origin + window.location.pathname + '?post=' + (post?.id ?? '')
              navigator.clipboard?.writeText(url).then(() => {}, () => {})
            }}
          >
            ↗ Share
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center border-t border-stone-100 px-2">
        <button
          type="button"
          disabled={busyLike}
          onClick={toggleLike}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition ${isLiked ? 'text-emerald-600' : 'text-stone-500 hover:bg-stone-50'} disabled:opacity-50`}
        >
          <span className={isLiked ? 'scale-110' : ''} style={{ transition: 'transform 0.15s ease' }}>{isLiked ? '❤️' : '👍'}</span>
          {isLiked ? 'Liked' : 'Like'}
        </button>
        <button
          type="button"
          onClick={toggleComments}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-50"
        >
          💬 Comment
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-stone-500 transition hover:bg-stone-50"
          onClick={() => {
            const url = window.location.origin + window.location.pathname + '?post=' + (post?.id ?? '')
            navigator.clipboard?.writeText(url).then(() => {}, () => {})
          }}
        >
          ↗ Share
        </button>
      </div>

      <ConfirmModal
        open={confirmDeletePost}
        onClose={() => setConfirmDeletePost(false)}
        onConfirm={doDeletePost}
        title="Delete post?"
        description="This will permanently remove the post and all its comments. This can't be undone."
        confirmLabel="Delete"
        loading={busyDelete}
      />
      <ConfirmModal
        open={!!confirmDeleteCommentId}
        onClose={() => setConfirmDeleteCommentId(null)}
        onConfirm={() => doDeleteComment(confirmDeleteCommentId)}
        title="Delete comment?"
        description="This comment will be permanently removed."
        confirmLabel="Delete"
        loading={!!busyDeleteCommentId}
      />
      <LikersModal open={likersOpen} onClose={() => setLikersOpen(false)} postId={post?.id} />

      {commentsOpen ? (
        <div className="border-t border-stone-100 px-5 py-3 space-y-3">
          <form onSubmit={submitComment} className="flex gap-2">
            <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" />
            <Button disabled={busyComment}>{busyComment ? '…' : 'Send'}</Button>
          </form>
          {thread.roots.length ? (
            <div className="space-y-2">
              {thread.roots.map((c) => renderCommentNode(c, 0))}
            </div>
          ) : (
            <div className="text-sm text-stone-500">No comments yet.</div>
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
    </div>
  )
}

