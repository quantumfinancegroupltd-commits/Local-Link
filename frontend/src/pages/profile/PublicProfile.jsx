import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'
import { Tabs } from '../../components/ui/Tabs.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { TrustBadge } from '../../components/ui/TrustBadge.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { FollowListModal } from '../../components/social/FollowListModal.jsx'
import { LikersModal } from '../../components/social/LikersModal.jsx'
import { AvailabilityCalendar } from '../../components/calendar/AvailabilityCalendar.jsx'
import { formatDurationMinutes } from '../../lib/duration.js'
import { WorkHistoryCard } from '../../components/profile/WorkHistory.jsx'
import { SkillEndorsementsCard } from '../../components/profile/SkillEndorsements.jsx'
import { ExperienceBadgesRow } from '../../components/profile/ExperienceBadges.jsx'
import { ExperienceBadgesModal } from '../../components/profile/ExperienceBadgesModal.jsx'

function kindLabel(kind) {
  if (kind === 'experience') return 'Experience'
  if (kind === 'education') return 'Education'
  if (kind === 'certification') return 'Certifications'
  if (kind === 'qualification') return 'Qualifications'
  if (kind === 'award') return 'Awards'
  return 'Resume'
}

function titleCaseWords(s) {
  const raw = String(s || '').trim()
  if (!raw) return ''
  return raw
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function formatDate(d) {
  if (!d) return null
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return String(d)
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  } catch {
    return String(d)
  }
}

function PostCard({ post, canDelete, canInteract, onRefresh, viewerId }) {
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
    if (!canInteract) return
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
    if (!canInteract) return
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
    if (!canInteract) return
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
    if (!canInteract) return
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
    if (!canInteract) return
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
    if (!canInteract) return
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
    if (!canInteract) return
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
    const canEdit = canInteract && !isDeleted && viewerId && cid && String(cid) === String(viewerId)
    const canReport = canInteract && !isDeleted && viewerId && cid && String(cid) !== String(viewerId)
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
              disabled={!canInteract || isDeleted || isLiking}
              onClick={() => toggleCommentLike(c)}
              className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              title={!canInteract ? 'Login to like comments' : undefined}
            >
              {c?.viewer_liked ? 'Unlike' : 'Like'}
              {!isDeleted && likeCount ? ` (${likeCount})` : ''}
            </button>
            {replyCount > 0 ? (
              <button
                type="button"
                disabled={!canInteract}
                onClick={() =>
                  setExpandedThreads((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {isExpanded ? 'Hide replies' : `View replies (${replyCount})`}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!canInteract || isDeleted}
              onClick={() => {
                setEditingId(null)
                setEditText('')
                setExpandedThreads((prev) => new Set(prev).add(id))
                setReplyingToId((prev) => (prev === id ? null : id))
                setReplyText('')
              }}
              className="rounded-full border bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              title={!canInteract ? 'Login to reply' : isDeleted ? 'Cannot reply to deleted comment' : undefined}
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
        {canDelete ? (
          <Button variant="secondary" disabled={busyDelete} onClick={del} title="Delete post">
            {busyDelete ? 'Deleting…' : 'Delete'}
          </Button>
        ) : null}
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
          <Button variant="secondary" disabled={busyLike || !canInteract} onClick={toggleLike} title={!canInteract ? 'Login to like' : undefined}>
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
          {canInteract ? (
            <form onSubmit={submitComment} className="flex gap-2">
              <Input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment…" />
              <Button disabled={busyComment}>{busyComment ? '…' : 'Send'}</Button>
            </form>
          ) : (
            <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Login to comment</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link to="/login">
                  <Button variant="secondary">Login</Button>
                </Link>
                <Link to="/register">
                  <Button>Create account</Button>
                </Link>
              </div>
            </div>
          )}
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

function normalizeUrlMaybe(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

export function PublicProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthed, user: viewer } = useAuth()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [roleProfile, setRoleProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [tab, setTab] = useState('posts') // posts | about

  const [followInfo, setFollowInfo] = useState(null) // {followers, following, viewer_following}
  const [followBusy, setFollowBusy] = useState(false)
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following' | null
  const [locked, setLocked] = useState(false)
  const [lockInfo, setLockInfo] = useState(null) // {code,message,follow_status,preview}

  const [resume, setResume] = useState([])
  const [resumeLoading, setResumeLoading] = useState(true)

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [postsError, setPostsError] = useState(null)

  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError] = useState(null)

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

  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [availability, setAvailability] = useState([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)

  const cover = user?.display_cover_url || profile?.cover_photo || user?.company_cover_url || null
  const links = Array.isArray(profile?.links) ? profile.links : []
  const isOwner = viewer?.id && id && String(viewer.id) === String(id)

  const canDeletePosts = false
  const canInteract = !!isAuthed

  const verificationTier = String(user?.verification_tier ?? 'unverified')
  const lastActiveLabel = useMemo(() => {
    const raw = user?.last_active_at
    if (!raw) return null
    const t = new Date(raw).getTime()
    if (!Number.isFinite(t)) return null
    const days = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)))
    if (days === 0) return 'Active today'
    if (days === 1) return 'Active 1 day ago'
    return `Active ${days} days ago`
  }, [user?.last_active_at])

  const locationLabel = useMemo(() => {
    if (String(user?.role) === 'artisan') return roleProfile?.service_area ?? null
    if (String(user?.role) === 'farmer') return roleProfile?.farm_location ?? null
    if (String(user?.role) === 'driver') return roleProfile?.area_of_operation ?? null
    if (String(user?.role) === 'company') return roleProfile?.location ?? user?.company_location ?? null
    return null
  }, [roleProfile, user?.role, user?.company_location])

  const shareUrl = useMemo(() => {
    try {
      return typeof window !== 'undefined' ? window.location.href : null
    } catch {
      return null
    }
  }, [])

  const headline = useMemo(() => {
    const role = String(user?.role ?? '')
    if (role === 'artisan') {
      const skills = Array.isArray(roleProfile?.skills) ? roleProfile.skills.filter(Boolean) : []
      const primary = skills[0] ? String(skills[0]) : null
      const area = roleProfile?.service_area ? String(roleProfile.service_area) : null
      return [primary, area].filter(Boolean).join(' • ') || 'Skilled service provider'
    }
    if (role === 'farmer') {
      const loc = roleProfile?.farm_location ? String(roleProfile.farm_location) : null
      const types = Array.isArray(roleProfile?.farm_type) ? roleProfile.farm_type.filter(Boolean).slice(0, 2) : []
      return [types.length ? types.join(', ') : null, loc].filter(Boolean).join(' • ') || 'Fresh produce supplier'
    }
    if (role === 'driver') {
      const v = roleProfile?.vehicle_type ? String(roleProfile.vehicle_type) : null
      const a = roleProfile?.area_of_operation ? String(roleProfile.area_of_operation) : null
      return [v ? `${v} delivery` : null, a].filter(Boolean).join(' • ') || 'Delivery partner'
    }
    if (role === 'buyer') return 'Buyer'
    return ''
  }, [roleProfile, user?.role])

  usePageMeta({
    title: user?.name ? `${user.name} • LocalLink` : 'Profile • LocalLink',
    description: profile?.bio ? String(profile.bio).slice(0, 160) : headline || 'LocalLink public profile',
    image: cover || user?.display_logo_url || user?.profile_pic || '/locallink-logo.png',
    url: shareUrl,
    type: 'profile',
  })

  async function loadPosts() {
    if (locked) {
      setPosts([])
      setPostsLoading(false)
      setPostsError(null)
      return
    }
    setPostsLoading(true)
    setPostsError(null)
    try {
      const r = await http.get(`/posts/user/${id}`)
      setPosts(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setPostsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load posts')
    } finally {
      setPostsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setLocked(false)
      setLockInfo(null)
      try {
        const res = await http.get(`/profile/${id}`).catch((e) => ({ __error: e }))
        if (cancelled) return

        // Company owners: redirect to company page so one URL shows the same content
        const slug = res?.data?.user?.company_slug ? String(res.data.user.company_slug).trim() : ''
        if (slug) {
          navigate(`/c/${encodeURIComponent(slug)}`, { replace: true })
          setLoading(false)
          return
        }

        if (res?.__error) {
          const e = res.__error
          const code = e?.response?.data?.code
          const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to load profile'
          const preview = e?.response?.data?.preview ?? null
          if (e?.response?.status === 403 && (code === 'FOLLOW_APPROVAL_REQUIRED' || code === 'LOGIN_REQUIRED')) {
            setLocked(true)
            setLockInfo({ ...(e.response.data ?? {}), message: msg, code: code || 'LOCKED', preview })
            setUser(preview)
            setProfile(null)
            setRoleProfile(null)
            setStats(null)
            setResume([])
            setReviews([])
            setHistory(null)
            setEndorse(null)
            setBadges(null)
            const f = await http.get(`/follows/${encodeURIComponent(id)}`).catch(() => ({ data: null }))
            if (!cancelled) setFollowInfo(f.data)
            return
          }
          setError(msg)
          return
        }

        const [rr, rev, f, hist, end, bdg] = await Promise.all([
          http.get(`/profile/${id}/resume`).catch(() => ({ data: [] })),
          http.get(`/reviews/public/${id}`).catch(() => ({ data: [] })),
          http.get(`/follows/${encodeURIComponent(id)}`).catch(() => ({ data: null })),
          http.get(`/profile/${encodeURIComponent(id)}/history?limit=12&offset=0`).catch(() => ({ data: null })),
          http.get(`/endorsements/user/${encodeURIComponent(id)}?limit=10`).catch(() => ({ data: null })),
          http.get(`/profile/${encodeURIComponent(id)}/badges`).catch(() => ({ data: null })),
        ])
        if (cancelled) return
        setUser(res.data?.user ?? null)
        setProfile(res.data?.profile ?? null)
        setRoleProfile(res.data?.role_profile ?? null)
        setStats(res.data?.stats ?? null)
        setResume(Array.isArray(rr.data) ? rr.data : [])
        setReviews(Array.isArray(rev.data) ? rev.data : [])
        setFollowInfo(f.data)
        setHistory(hist.data ?? null)
        setHistoryError(null)
        setEndorse(end.data ?? null)
        setEndorseError(null)
        setBadges(bdg.data ?? null)
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load profile')
      } finally {
        if (!cancelled) {
          setLoading(false)
          setResumeLoading(false)
          setReviewsLoading(false)
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
  }, [id])

  const canFollow = useMemo(() => {
    if (!isAuthed) return false
    if (!viewer?.id) return false
    if (!id) return false
    return String(viewer.id) !== String(id)
  }, [isAuthed, viewer?.id, id])

  async function toggleFollow() {
    if (!canFollow) return
    if (followInfo?.viewer_requested) return
    setFollowBusy(true)
    try {
      const isFollowing = !!followInfo?.viewer_following
      if (isFollowing) await http.delete(`/follows/${encodeURIComponent(id)}`)
      else {
        const r = await http.post(`/follows/${encodeURIComponent(id)}`)
        if (r.data?.pending) toast.success('Request sent', 'Waiting for approval.')
      }
      const r = await http.get(`/follows/${encodeURIComponent(id)}`).catch(() => ({ data: null }))
      setFollowInfo(r.data)
      if (isFollowing) toast.success('Unfollowed.')
      else if (r?.data?.viewer_following) toast.success('Following.')
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed')
    } finally {
      setFollowBusy(false)
    }
  }

  async function loadMoreHistory() {
    if (!id) return
    if (historyBusy) return
    setHistoryBusy(true)
    setHistoryError(null)
    try {
      const offset = Array.isArray(history?.items) ? history.items.length : 0
      const r = await http.get(`/profile/${encodeURIComponent(id)}/history?limit=12&offset=${offset}`)
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

  async function refreshFollowInfo() {
    const r = await http.get(`/follows/${encodeURIComponent(id)}`).catch(() => ({ data: null }))
    setFollowInfo(r.data)
  }

  useEffect(() => {
    if (!locked) loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, locked])

  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear())

  // Load artisan services and availability when viewing artisan profile (12 months ahead)
  useEffect(() => {
    if (!id || user?.role !== 'artisan' || locked) return
    let cancelled = false
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const to = new Date(now.getFullYear(), now.getMonth() + 12, 0).toISOString().slice(0, 10)
    setServicesLoading(true)
    setAvailabilityLoading(true)
    Promise.all([
      http.get(`/artisans/${encodeURIComponent(id)}/services`).catch(() => ({ data: [] })),
      http.get(`/artisans/${encodeURIComponent(id)}/availability`, { params: { from, to } }).catch(() => ({ data: [] })),
    ]).then(([sRes, aRes]) => {
      if (cancelled) return
      setServices(Array.isArray(sRes.data) ? sRes.data : [])
      const raw = Array.isArray(aRes.data) ? aRes.data : []
      const normalized = raw.map((d) => {
        if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d
        if (d && typeof d === 'object' && typeof d.date === 'string') return d.date.slice(0, 10)
        if (d != null) return String(d).slice(0, 10)
        return null
      }).filter(Boolean)
      setAvailability(normalized)
    }).finally(() => {
      if (!cancelled) {
        setServicesLoading(false)
        setAvailabilityLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [id, user?.role, locked])

  const roleLabel = useMemo(() => {
    const r = String(user?.role || '')
    if (r === 'artisan') {
      const primary =
        (roleProfile?.primary_skill ? String(roleProfile.primary_skill) : '') ||
        (Array.isArray(roleProfile?.skills) ? String(roleProfile.skills.filter(Boolean)[0] || '') : '')
      return titleCaseWords(primary || 'Artisan')
    }
    return r ? r.toUpperCase() : ''
  }, [roleProfile?.primary_skill, roleProfile?.skills, user?.role])
  const showTier = verificationTier && verificationTier !== 'unverified'
  const hasBadges = !badgesLoading && Array.isArray(badges?.badges) && badges.badges.length > 0

  async function copyShareLink() {
    try {
      const text = shareUrl || `${window.location.origin}/u/${encodeURIComponent(id)}`
      await navigator.clipboard.writeText(text)
      toast.push({ title: 'Link copied', variant: 'success' })
    } catch {
      toast.push({ title: 'Could not copy link', description: 'Your browser blocked clipboard access.', variant: 'error' })
    }
  }

  async function nativeShare() {
    try {
      if (!navigator.share) return copyShareLink()
      await navigator.share({
        title: user?.name ? `${user.name} • LocalLink` : 'LocalLink',
        text: headline || 'LocalLink public profile',
        url: shareUrl || undefined,
      })
    } catch {
      // ignore (user cancelled)
    }
  }
  const resumeByKind = useMemo(() => {
    const map = new Map()
    for (const e of Array.isArray(resume) ? resume : []) {
      const k = e?.kind || 'experience'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(e)
    }
    return map
  }, [resume])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FollowListModal
        open={!!followModal}
        onClose={() => setFollowModal(null)}
        userId={id}
        viewerId={viewer?.id ?? null}
        initialTab={followModal ?? 'followers'}
        onCountsChange={refreshFollowInfo}
      />
      <ExperienceBadgesModal
        open={badgesOpen}
        onClose={() => setBadgesOpen(false)}
        title="Badges"
        badges={badges?.badges ?? []}
        computedAt={badges?.computed_at ?? null}
        initialKey={badgesFocusKey}
      />
      <div className="flex items-center justify-between gap-3">
        <Link to="/">
          <Button variant="secondary">Back</Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          {isOwner && user?.role === 'company' ? (
            <Link to="/company">
              <Button variant="secondary">Edit profile</Button>
            </Link>
          ) : null}
          <Button variant="secondary" onClick={copyShareLink}>
            Copy link
          </Button>
          <Button onClick={nativeShare}>Share</Button>
          {canFollow ? (
            <Button
              variant={followInfo?.viewer_following || followInfo?.viewer_requested ? 'secondary' : 'primary'}
              disabled={followBusy || !!followInfo?.viewer_requested}
              onClick={toggleFollow}
              title={followInfo?.viewer_requested ? 'Follow request pending approval' : undefined}
            >
              {followBusy ? 'Working…' : followInfo?.viewer_requested ? 'Requested' : followInfo?.viewer_following ? 'Following' : 'Follow'}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <EmptyState
          title="Profile not found"
          description={error}
          actions={
            <Link to="/">
              <Button variant="secondary">Go home</Button>
            </Link>
          }
        />
      ) : (
        <>
          {locked ? (
            <Card>
              <div className="text-sm font-semibold text-slate-900">Private profile</div>
              <div className="mt-2 text-sm text-slate-700">{lockInfo?.message || 'This profile is private.'}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {lockInfo?.code === 'LOGIN_REQUIRED' ? (
                  <Link to="/login">
                    <Button>Login to request access</Button>
                  </Link>
                ) : null}
                <Button variant="secondary" type="button" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                If you’ve requested to follow, the owner must approve before you can view full profile details.
              </div>
            </Card>
          ) : null}
          <div className="overflow-hidden rounded-3xl border bg-white">
            <div className="relative h-48 bg-slate-200">
              {cover ? (
                <img src={cover} alt="Cover" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-r from-emerald-400 via-lime-300 to-orange-300" />
              )}
              {/* Subtle overlay so the cover always looks clean/readable */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/50" />
            </div>
            <div className="px-6 pb-5 pt-0">
              {/* Twitter/Facebook style header: avatar + name on a solid card (not directly on the cover) */}
              <div className="-mt-12 relative z-10 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-end gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-sm">
                    <img src={user?.display_logo_url || user?.profile_pic || '/locallink-logo.png'} alt="Profile" className="h-full w-full object-cover" />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                    <div className="text-xl font-bold text-slate-900 md:text-2xl">{user?.name || 'Profile'}</div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      <span className="font-semibold">{roleLabel}</span>
                      {headline ? (
                        <>
                          <span className="mx-2">•</span>
                          <span className="font-semibold">{headline}</span>
                        </>
                      ) : null}
                      <span className="mx-2">•</span>
                      Rating {Number(user?.rating ?? 0).toFixed(1)} {user?.verified ? '• Verified' : ''}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <TrustBadge trustScore={user?.trust_score} />
                      {hasBadges ? (
                        <ExperienceBadgesRow
                          badges={badges?.badges ?? []}
                          max={4}
                          className="mt-0"
                          onBadgeClick={(b) => {
                            setBadgesFocusKey(b?.key ?? null)
                            setBadgesOpen(true)
                          }}
                        />
                      ) : null}
                      {hasBadges ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBadgesFocusKey(null)
                            setBadgesOpen(true)
                          }}
                          className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                          title="View all badges"
                        >
                          View badges
                        </button>
                      ) : null}
                      {followInfo ? (
                        <button
                          type="button"
                          onClick={() => setFollowModal('followers')}
                          className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title="View followers and following"
                        >
                          {Number(followInfo.followers ?? 0)} followers • {Number(followInfo.following ?? 0)} following
                        </button>
                      ) : null}
                      {locationLabel ? (
                        <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">📍 {locationLabel}</span>
                      ) : null}
                      {lastActiveLabel ? (
                        <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">{lastActiveLabel}</span>
                      ) : null}
                      {showTier ? (
                        <span className="rounded-full border bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                          Verification: {String(verificationTier).toUpperCase()}
                        </span>
                      ) : (
                        <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">Unverified</span>
                      )}
                      {typeof stats?.reviews === 'number' ? (
                        <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {typeof stats?.verified_reviews === 'number' ? `${stats.verified_reviews} verified reviews` : `${stats.reviews} reviews`}
                        </span>
                      ) : null}
                      {typeof stats?.posts === 'number' ? (
                        <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {stats.posts} posts
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Tabs
                    value={tab}
                    onChange={setTab}
                    tabs={[
                      { value: 'posts', label: 'Posts' },
                      { value: 'about', label: 'About' },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-4 max-w-2xl">
                {(profile?.bio || user?.company_description) ? (
                  <div className="text-sm text-slate-800 whitespace-pre-wrap">
                    {profile?.bio || user?.company_description || ''}
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">No bio yet.</div>
                )}
                {links.filter((l) => l?.label && l?.url).length ? (
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

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="text-sm font-semibold">Featured work</div>
              {postsLoading ? (
                <div className="mt-2 text-sm text-slate-600">Loading…</div>
              ) : posts.length === 0 ? (
                <div className="mt-2 text-sm text-slate-600">No posts yet.</div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {posts
                    .flatMap((p) => (Array.isArray(p?.media) ? p.media : []))
                    .filter((m) => m?.url)
                    .slice(0, 4)
                    .map((m) => (
                      <div key={m.url} className="overflow-hidden rounded-2xl border bg-white">
                        {m.kind === 'video' ? (
                          <video src={m.url} controls className="h-48 w-full object-cover" />
                        ) : (
                          <img src={m.url} alt="featured" className="h-48 w-full object-cover" loading="lazy" />
                        )}
                      </div>
                    ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/trust/escrow">
                  <Button variant="secondary">How escrow keeps you safe</Button>
                </Link>
                <Link to="/trust/verification">
                  <Button variant="secondary">Verification tiers</Button>
                </Link>
                <Link to="/onboarding">
                  <Button>Get started</Button>
                </Link>
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold">Quick facts</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {user?.role === 'company' &&
                (roleProfile?.industry ||
                  roleProfile?.location ||
                  roleProfile?.size_range ||
                  user?.company_industry ||
                  user?.company_location ||
                  user?.company_size_range ||
                  roleProfile?.website ||
                  user?.company_website) ? (
                  <>
                    {(roleProfile?.industry ?? user?.company_industry) ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-600">Industry</div>
                        <div className="mt-1">{String(roleProfile?.industry ?? user?.company_industry ?? '')}</div>
                      </div>
                    ) : null}
                    {(roleProfile?.location ?? user?.company_location) ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-600">Location</div>
                        <div className="mt-1">{String(roleProfile?.location ?? user?.company_location ?? '')}</div>
                      </div>
                    ) : null}
                    {(roleProfile?.size_range ?? user?.company_size_range) ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-600">Team size</div>
                        <div className="mt-1">{String(roleProfile?.size_range ?? user?.company_size_range ?? '')}</div>
                      </div>
                    ) : null}
                    {(roleProfile?.website ?? user?.company_website) ? (
                      <div>
                        <div className="text-xs font-semibold text-slate-600">Website</div>
                        <a
                          href={
                            /^https?:\/\//i.test(String(roleProfile?.website ?? user?.company_website ?? ''))
                              ? String(roleProfile?.website ?? user?.company_website ?? '')
                              : `https://${String(roleProfile?.website ?? user?.company_website ?? '').trim()}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-emerald-700 hover:underline"
                        >
                          {String(roleProfile?.website ?? user?.company_website ?? '')}
                        </a>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {user?.role === 'artisan' && Array.isArray(roleProfile?.skills) && roleProfile.skills.filter(Boolean).length ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Skills</div>
                    <div className="mt-1">{roleProfile.skills.filter(Boolean).slice(0, 8).join(', ')}</div>
                  </div>
                ) : null}
                {user?.role === 'artisan' && roleProfile?.service_area ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Service area</div>
                    <div className="mt-1">{String(roleProfile.service_area)}</div>
                  </div>
                ) : null}
                {user?.role === 'artisan' && Array.isArray(roleProfile?.job_categories) && roleProfile.job_categories.length ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Job categories</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {roleProfile.job_categories.map((c) => (
                        <span key={c} className="rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-700">{c}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {user?.role === 'farmer' && roleProfile?.farm_location ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Farm location</div>
                    <div className="mt-1">{String(roleProfile.farm_location)}</div>
                  </div>
                ) : null}
                {user?.role === 'driver' && roleProfile?.area_of_operation ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Area</div>
                    <div className="mt-1">{String(roleProfile.area_of_operation)}</div>
                  </div>
                ) : null}
                {links.filter((l) => l?.label && l?.url).length ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Links</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {links
                        .filter((l) => l?.label && l?.url)
                        .slice(0, 4)
                        .map((l) => (
                          <a key={`${l.label}-${l.url}`} href={l.url} target="_blank" rel="noreferrer" className="underline">
                            {l.label}
                          </a>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          {user?.role === 'artisan' ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <div className="text-sm font-semibold">Services</div>
                <div className="mt-1 text-xs text-slate-600">Fixed-price offerings you can book directly.</div>
                {servicesLoading ? (
                  <div className="mt-3 text-sm text-slate-600">Loading…</div>
                ) : services.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">No services listed yet.</div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {services.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border bg-slate-50/50 p-3">
                        {s.image_url ? (
                          <img src={s.image_url} alt={s.title} className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900">{s.title}</div>
                          {s.description ? <div className="mt-0.5 text-xs text-slate-600">{s.description}</div> : null}
                          <div className="mt-1 text-sm font-semibold text-slate-700">
                            {s.currency} {Number(s.price).toFixed(0)}
                            {(function () { const d = formatDurationMinutes(s.duration_minutes); return d ? ` • ${d}` : ''; })()}
                          </div>
                        </div>
                        <Link
                          className="shrink-0"
                          to={
                            isAuthed && viewer?.role === 'buyer'
                              ? `/buyer/jobs/new?artisan=${encodeURIComponent(id)}&service=${encodeURIComponent(s.id)}&title=${encodeURIComponent(s.title)}&description=${encodeURIComponent(s.description || '')}&budget=${encodeURIComponent(s.price)}&category=${encodeURIComponent(s.category || '')}`
                              : `/login?next=${encodeURIComponent(`/buyer/jobs/new?artisan=${id}&service=${s.id}&title=${encodeURIComponent(s.title)}&description=${encodeURIComponent(s.description || '')}&budget=${s.price}&category=${encodeURIComponent(s.category || '')}`)}`
                          }
                        >
                          <Button size="sm">Book</Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card>
                <div className="text-sm font-semibold">Availability</div>
                <div className="mt-1 text-xs text-slate-600">Browse dates when this provider is available for bookings.</div>
                {availabilityLoading ? (
                  <div className="mt-4 text-sm text-slate-600">Loading…</div>
                ) : availability.length === 0 ? (
                  <div className="mt-4 text-sm text-slate-600">No dates set yet.</div>
                ) : (
                  <div className="mt-4">
                    <AvailabilityCalendar
                      availableDates={availability}
                      month={calendarMonth}
                      year={calendarYear}
                      onMonthChange={(m, y) => {
                        setCalendarMonth(m)
                        setCalendarYear(y)
                      }}
                      disabledPast={false}
                      loading={false}
                      compact
                    />
                  </div>
                )}
              </Card>
            </div>
          ) : null}

          {tab === 'about' ? (
            <div className="space-y-4">
              <Card>
                <div className="text-sm font-semibold">About</div>
                <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{profile?.bio || '—'}</div>
              </Card>

              <WorkHistoryCard
                loading={historyLoading}
                error={historyError}
                data={history}
                onLoadMore={loadMoreHistory}
                loadMoreBusy={historyBusy}
              />

              <SkillEndorsementsCard loading={endorseLoading} error={endorseError} data={endorse} />

              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Reviews</div>
                    <div className="mt-1 text-xs text-slate-600">Only verified transactions count toward reputation.</div>
                  </div>
                  <Link to="/trust/reviews">
                    <Button variant="secondary" size="sm">
                      How it works
                    </Button>
                  </Link>
                </div>

                {reviewsLoading ? (
                  <div className="mt-3 text-sm text-slate-600">Loading…</div>
                ) : reviewsError ? (
                  <div className="mt-3 text-sm text-red-700">{reviewsError}</div>
                ) : reviews.length === 0 ? (
                  <div className="mt-3 text-sm text-slate-600">No reviews yet.</div>
                ) : (
                  <div className="mt-3 divide-y">
                    {reviews.slice(0, 6).map((r) => (
                      <div key={r.id} className="py-4">
                        <div className="flex items-start gap-3">
                          <img
                            src={r.reviewer_profile_pic || '/locallink-logo.png'}
                            alt="reviewer"
                            className="h-10 w-10 rounded-2xl border object-cover"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">
                              {r.rating} ★ • {r.reviewer_name || 'User'} ({String(r.reviewer_role || '—').toUpperCase()})
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                Verified transaction
                              </span>
                              {r.job_id ? (
                                <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  Job {String(r.job_id).slice(0, 8)}
                                </span>
                              ) : r.order_id ? (
                                <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                  Order {String(r.order_id).slice(0, 8)}
                                </span>
                              ) : null}
                            </div>
                            {r.comment ? <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{r.comment}</div> : null}
                            <div className="mt-2 text-xs text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {resumeLoading ? (
                <Card>Loading resume…</Card>
              ) : resume.length === 0 ? (
                <Card>
                  <div className="text-sm font-semibold">Resume</div>
                  <div className="mt-2 text-sm text-slate-600">No experience/education added yet.</div>
                </Card>
              ) : (
                ['experience', 'education', 'certification', 'qualification', 'award'].map((kind) => {
                  const list = resumeByKind.get(kind) ?? []
                  if (!list.length) return null
                  return (
                    <Card key={kind}>
                      <div className="text-sm font-semibold">{kindLabel(kind)}</div>
                      <div className="mt-3 space-y-3">
                        {list.map((e) => {
                          const range = [formatDate(e.start_date), formatDate(e.end_date)].filter(Boolean).join(' — ')
                          const org = e.org_name ? String(e.org_name) : ''
                          const title = e.title ? String(e.title) : ''
                          const field = e.field ? String(e.field) : ''
                          const loc = e.location ? String(e.location) : ''
                          const media = Array.isArray(e?.media) ? e.media : []
                          const canShowMedia = ['education', 'certification', 'qualification'].includes(String(e?.kind || ''))
                          const images = canShowMedia ? media.filter((m) => String(m?.kind || '') === 'image' && m?.url).slice(0, 3) : []
                          return (
                            <div key={e.id} className="rounded-2xl border bg-white p-4">
                              <div className="text-sm font-semibold text-slate-900">{title || org || 'Entry'}</div>
                              <div className="mt-1 text-sm text-slate-700">
                                {[org && org !== title ? org : null, field, loc].filter(Boolean).join(' • ')}
                              </div>
                              {range ? <div className="mt-1 text-xs text-slate-500">{range}</div> : null}
                              {e.description ? <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{e.description}</div> : null}
                              {images.length ? (
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {images.map((m) => (
                                    <a
                                      key={m.url}
                                      href={m.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="overflow-hidden rounded-2xl border bg-white hover:opacity-95"
                                      title="Open image"
                                    >
                                      <img src={m.thumb_url || m.url} alt="proof" className="h-24 w-full object-cover" loading="lazy" />
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                              {e.url ? (
                                <div className="mt-2 text-sm">
                                  <a className="underline" href={normalizeUrlMaybe(e.url)} target="_blank" rel="noreferrer">
                                    View link
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          ) : postsLoading ? (
            <Card>Loading posts…</Card>
          ) : postsError ? (
            <Card>
              <div className="text-sm text-red-700">{postsError}</div>
            </Card>
          ) : posts.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-600">No posts yet.</div>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  canDelete={canDeletePosts}
                  canInteract={canInteract}
                  onRefresh={loadPosts}
                  viewerId={viewer?.id ?? null}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}


