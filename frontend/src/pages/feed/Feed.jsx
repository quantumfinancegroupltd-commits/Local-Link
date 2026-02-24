import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'
import { SocialPostCard } from '../../components/social/SocialPostCard.jsx'
import { FeedLayout } from '../../components/feed/FeedLayout.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { useDraftAutosave } from '../../lib/drafts.js'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'

function CreatePostCard({ viewerId, onPosted, autoFocus = false }) {
  const toast = useToast()
  const { online } = useOnlineStatus()
  const textRef = useRef(null)
  const fileInputRef = useRef(null)

  const [text, setText] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const draft = useDraftAutosave({
    key: `draft:feed:create_post:${viewerId ?? 'unknown'}`,
    data: { text },
    enabled: Boolean(viewerId),
    debounceMs: 750,
  })

  useEffect(() => {
    if (text) return
    const d = draft.load()
    if (!d?.text) return
    setText(String(d.text))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoFocus) return
    const t = setTimeout(() => {
      try {
        textRef.current?.focus?.()
        textRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      } catch {
        // ignore
      }
    }, 50)
    return () => clearTimeout(t)
  }, [autoFocus])

  const previews = useMemo(() => {
    return (Array.isArray(files) ? files : []).map((f) => ({
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
      toast.success('Posted.')
      await onPosted?.()
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
        <div className="text-xs text-slate-500">{draft.savedAt ? <span className="text-emerald-700">Draft saved</span> : <span>Draft not saved yet</span>}</div>
      </div>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <textarea
          id="create-post-text"
          name="postText"
          ref={textRef}
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          rows={3}
          placeholder="Share an update…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click?.()}
          >
            Photo
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click?.()}
          >
            Video
          </Button>
          <input
            id="create-post-media"
            name="postMedia"
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
            disabled={busy}
          />
        </div>
        <div className="text-xs text-slate-500">Images/videos supported. Max 50MB per file.</div>
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

function profileLinkForUser(u) {
  if (!u?.id) return '/people'
  const role = String(u?.role || '')
  const slug = u?.company_slug ? String(u.company_slug) : ''
  if (role === 'company' && slug) return `/c/${encodeURIComponent(slug)}`
  return `/u/${encodeURIComponent(u.id)}`
}

function SuggestedCard({ user, onFollow, busy }) {
  const to = profileLinkForUser(user)
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-white p-3">
      <Link to={to} className="flex min-w-0 items-center gap-3">
        <img src={user?.profile_pic || '/locallink-logo.png'} alt="avatar" className="h-10 w-10 rounded-2xl border object-cover" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{user?.name || 'User'}</div>
          <div className="text-xs text-slate-500">{String(user?.role || '').toUpperCase()}</div>
        </div>
      </Link>
      <Button size="sm" disabled={busy} onClick={() => onFollow(user.id)}>
        Follow
      </Button>
    </div>
  )
}

function JoinConversationCard() {
  return (
    <Card className="rounded-2xl border-slate-200 bg-slate-50/50 shadow-sm">
      <div className="text-sm font-semibold text-slate-800">Join the conversation!</div>
      <p className="mt-2 text-sm text-slate-700">
        &ldquo;Using LocalLink has really boosted my business!&rdquo; #gratitude
      </p>
      <div className="mt-3 flex items-center gap-2">
        <img src="/locallink-logo.png" alt="" className="h-8 w-8 rounded-full border border-slate-200 object-cover" />
        <span className="text-sm font-medium text-slate-800">Afia Addo</span>
        <span className="text-xs text-slate-500">Artisan</span>
        <span className="text-slate-400" aria-hidden>💬</span>
      </div>
    </Card>
  )
}

export function Feed() {
  usePageMeta({ title: 'Feed • LocalLink', description: 'Updates from people you follow.' })

  const toast = useToast()
  const { user } = useAuth()
  const viewerId = user?.id ?? null
  const [params] = useSearchParams()
  const compose = String(params.get('compose') || '').toLowerCase()
  const composeMode = compose === '1' || compose === 'true' || compose === 'yes'
  const topicSlug = params.get('topic') ?? ''
  const TOPIC_LABELS = { 'rainy-season': 'Rainy Season Tips', 'kumasi-jobs': 'New Jobs in Kumasi', 'escrow': 'How Escrow Works' }
  const topicLabel = topicSlug ? (TOPIC_LABELS[topicSlug] ?? topicSlug) : ''

  const [posts, setPosts] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  const [suggested, setSuggested] = useState([])
  const [suggestedLoading, setSuggestedLoading] = useState(true)
  const [followBusyId, setFollowBusyId] = useState(null)
  const [topPostId, setTopPostId] = useState(null)
  const [showNewPostsBanner, setShowNewPostsBanner] = useState(false)

  const FEED_PAGE_SIZE = 20

  const loadFeed = useCallback(async (cursor = null) => {
    const isInitial = cursor == null
    if (isInitial) {
      setLoading(true)
      setError(null)
      setShowNewPostsBanner(false)
    } else {
      setLoadingMore(true)
    }
    try {
      const queryParams = { limit: FEED_PAGE_SIZE }
      if (cursor) queryParams.cursor = cursor
      if (topicSlug) queryParams.topic = topicSlug
      const r = await http.get('/posts/feed', { params: queryParams })
      const items = Array.isArray(r.data?.items) ? r.data.items : []
      const next = r.data?.next_cursor ?? null
      if (isInitial) {
        setPosts(items)
        setTopPostId(items[0]?.id ?? null)
      } else {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          const added = items.filter((p) => p.id && !seen.has(p.id))
          return prev.concat(added)
        })
      }
      setNextCursor(next)
    } catch (e) {
      if (isInitial) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load feed')
      else toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to load more')
    } finally {
      if (isInitial) setLoading(false)
      else setLoadingMore(false)
    }
  }, [toast, topicSlug])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    await loadFeed(nextCursor)
  }

  async function loadSuggested() {
    setSuggestedLoading(true)
    try {
      const r = await http.get('/follows/suggested/list')
      setSuggested(Array.isArray(r.data) ? r.data : [])
    } catch {
      setSuggested([])
    } finally {
      setSuggestedLoading(false)
    }
  }

  useEffect(() => {
    loadFeed()
    loadSuggested()
  }, [topicSlug])

  // Check for new posts when tab becomes visible or every 90s
  useEffect(() => {
    if (posts.length === 0 || loading) return
    function checkNew() {
      http.get('/posts/feed', { params: { limit: 1 } })
        .then((r) => {
          const first = r.data?.items?.[0]
          if (first?.id && first.id !== topPostId) setShowNewPostsBanner(true)
        })
        .catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkNew()
    }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(checkNew, 90000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(t)
    }
  }, [posts.length, loading, topPostId])

  useEffect(() => {
    if (!composeMode) return
    const t = setTimeout(() => {
      const el = document.getElementById('feed-compose')
      if (!el) return
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } catch {
        // ignore
      }
    }, 50)
    return () => clearTimeout(t)
  }, [composeMode])

  async function follow(userId) {
    setFollowBusyId(userId)
    try {
      await http.post(`/follows/${encodeURIComponent(userId)}`)
      toast.success('Following.')
      await loadFeed()
      await loadSuggested()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to follow')
    } finally {
      setFollowBusyId(null)
    }
  }

  const empty = useMemo(() => !loading && !error && posts.length === 0, [loading, error, posts.length])

  const leftSuggestedSection = (
    <Card className="overflow-hidden rounded-2xl border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">Suggested to follow</div>
        <Button size="sm" variant="secondary" onClick={loadSuggested} disabled={suggestedLoading}>
          Refresh
        </Button>
      </div>
      {suggestedLoading ? (
        <div className="mt-3 text-sm text-slate-600">Loading…</div>
      ) : suggested.length === 0 ? (
        <div className="mt-3 text-sm text-slate-600">No suggestions right now.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {suggested.map((u) => (
            <SuggestedCard key={u.id} user={u} onFollow={follow} busy={followBusyId === u.id} />
          ))}
        </div>
      )}
      <Link to="/people" className="mt-2 block text-xs font-medium text-emerald-700 hover:underline">
        See all &gt;
      </Link>
    </Card>
  )

  return (
    <FeedLayout leftSuggestedSection={leftSuggestedSection}>
      <div className="space-y-6">
        <PageHeader
          kicker="Community"
          title="Feed"
          subtitle="Posts from people you follow (and your own posts)."
        />

        <div id="feed-compose">
          <CreatePostCard viewerId={viewerId} onPosted={() => loadFeed()} autoFocus={composeMode} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {topicSlug ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                Trending: {topicLabel}
                <Link to="/feed" className="font-semibold text-emerald-700 hover:underline" aria-label="Clear topic">
                  ×
                </Link>
              </span>
            ) : null}
            <span className="text-xs text-slate-500">Follow providers or friends to curate your feed.</span>
            <span className="text-[10px] text-slate-400" title="Build identifier">v2026-02</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => loadFeed()} disabled={loading}>
              Refresh
            </Button>
            <Link to="/people">
              <Button variant="secondary">Find people</Button>
            </Link>
          </div>
        </div>

        {showNewPostsBanner && !loading && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-sm font-medium text-emerald-900">New posts available</span>
            <Button size="sm" onClick={() => loadFeed()}>
              Refresh
            </Button>
          </div>
        )}

        {loading ? (
          <Card className="rounded-2xl border-slate-200 p-8 text-center text-slate-600 shadow-sm">Loading…</Card>
        ) : error ? (
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <div className="text-sm text-red-700">{error}</div>
          </Card>
        ) : empty ? (
          <Card className="rounded-2xl border-slate-200 p-8 text-center shadow-sm">
            <div className="text-sm text-slate-600">Your feed is empty. Follow someone or post an update.</div>
            <Link to="/people" className="mt-3 inline-block">
              <Button>Find people</Button>
            </Link>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {posts.map((p) => (
                <SocialPostCard key={p.id} post={p} viewerId={viewerId} onRefresh={() => loadFeed()} />
              ))}
            </div>
            <JoinConversationCard />
            {nextCursor ? (
              <div className="flex justify-center py-4">
                <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </FeedLayout>
  )
}

