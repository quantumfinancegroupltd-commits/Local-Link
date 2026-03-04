import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Select } from '../../components/ui/FormControls.jsx'
import { SocialPostCard } from '../../components/social/SocialPostCard.jsx'
import { FeedLayout } from '../../components/feed/FeedLayout.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { useDraftAutosave } from '../../lib/drafts.js'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'

function CreatePostCard({ viewerId, userPic, onPosted, autoFocus = false }) {
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
      } catch { /* ignore */ }
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
    return () => { for (const p of previews) URL.revokeObjectURL(p.url) }
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
    <div className="rounded-2xl border border-stone-200/60 bg-white p-4 shadow-sm">
      <form onSubmit={submit}>
        <div className="flex gap-3">
          <img
            src={userPic || '/locallink-logo.png'}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full border border-stone-200 object-cover"
          />
          <textarea
            id="create-post-text"
            name="postText"
            ref={textRef}
            className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            rows={2}
            placeholder="Share an update..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
        </div>

        {previews.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {previews.map((p) => (
              <div key={p.url} className="relative overflow-hidden rounded-xl border bg-white">
                {p.kind === 'video' ? (
                  <video src={p.url} controls className="h-40 w-full object-cover" />
                ) : (
                  <img src={p.url} alt={p.name} className="h-40 w-full object-cover" loading="lazy" />
                )}
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-black/70"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== previews.indexOf(p)))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}

        <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3">
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click?.()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
              Photo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click?.()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
            >
              <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              disabled={busy}
            />
          </div>
          <Button disabled={busy} className="px-6">
            {busy ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function profileLinkForUser(u) {
  if (!u?.id) return '/people'
  const role = String(u?.role || '')
  const slug = u?.company_slug ? String(u.company_slug) : ''
  if (role === 'company' && slug) return `/c/${encodeURIComponent(slug)}`
  return `/u/${encodeURIComponent(u.id)}`
}

function SuggestedUserRow({ user, onFollow, busy }) {
  const to = profileLinkForUser(user)
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Link to={to} className="shrink-0">
        <img
          src={user?.profile_pic || '/locallink-logo.png'}
          alt=""
          className="h-9 w-9 rounded-full border border-stone-200 object-cover"
        />
      </Link>
      <Link to={to} className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{user?.name || 'User'}</div>
        <div className="text-[11px] text-slate-500">{String(user?.role || '').charAt(0).toUpperCase() + String(user?.role || '').slice(1)}</div>
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => onFollow(user.id)}
        className="shrink-0 rounded-lg bg-brand-green px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        Follow
      </button>
    </div>
  )
}

function JoinConversationCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-900">Join the conversation!</div>
      <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        &ldquo;Using LocalLink has really boosted my business!&rdquo; #gratitude
      </div>
      <div className="mt-3 flex items-center gap-2">
        <img src="/locallink-logo.png" alt="" className="h-7 w-7 rounded-full border border-slate-200 object-cover" />
        <span className="text-sm font-medium text-slate-800">Afia Addo</span>
        <span className="text-[11px] text-slate-500">• Artisan</span>
      </div>
    </div>
  )
}

export function Feed() {
  usePageMeta({ title: 'Feed • LocalLink', description: 'Updates from people you follow.' })

  const toast = useToast()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const viewerId = user?.id ?? null
  const [params, setParams] = useSearchParams()
  const compose = String(params.get('compose') || '').toLowerCase()
  const composeMode = compose === '1' || compose === 'true' || compose === 'yes'
  const topicSlug = params.get('topic') ?? ''
  const sortParam = (params.get('sort') ?? 'top').toLowerCase()
  const feedSort = sortParam === 'newest' ? 'newest' : 'top'
  const TOPIC_LABELS = { 'rainy-season': 'Rainy Season Tips', 'kumasi-jobs': 'New Jobs in Kumasi', 'escrow': 'How Escrow Works' }
  const topicLabel = topicSlug ? (TOPIC_LABELS[topicSlug] ?? topicSlug) : ''
  const TOPIC_CHIPS = [{ slug: '', label: 'All' }, ...Object.entries(TOPIC_LABELS).map(([slug, label]) => ({ slug, label }))]

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
    if (isInitial) { setLoading(true); setError(null); setShowNewPostsBanner(false) }
    else setLoadingMore(true)
    try {
      const queryParams = { limit: FEED_PAGE_SIZE, sort: feedSort }
      if (cursor) queryParams.cursor = cursor
      if (topicSlug) queryParams.topic = topicSlug
      const r = await http.get('/posts/feed', { params: queryParams })
      const items = Array.isArray(r.data?.items) ? r.data.items : []
      const next = r.data?.next_cursor ?? null
      if (isInitial) { setPosts(items); setTopPostId(items[0]?.id ?? null) }
      else {
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id))
          return prev.concat(items.filter((p) => p.id && !seen.has(p.id)))
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
  }, [toast, topicSlug, feedSort])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    await loadFeed(nextCursor)
  }

  async function loadSuggested() {
    setSuggestedLoading(true)
    try {
      const r = await http.get('/follows/suggested/list')
      setSuggested(Array.isArray(r.data) ? r.data : [])
    } catch { setSuggested([]) }
    finally { setSuggestedLoading(false) }
  }

  useEffect(() => { loadFeed(); loadSuggested() }, [topicSlug, feedSort])

  useEffect(() => {
    if (posts.length === 0 || loading) return
    function checkNew() {
      http.get('/posts/feed', { params: { limit: 1, sort: feedSort } })
        .then((r) => {
          const first = r.data?.items?.[0]
          if (first?.id && first.id !== topPostId) setShowNewPostsBanner(true)
        })
        .catch(() => {})
    }
    const onVisible = () => { if (document.visibilityState === 'visible') checkNew() }
    document.addEventListener('visibilitychange', onVisible)
    const t = setInterval(checkNew, 90000)
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t) }
  }, [posts.length, loading, topPostId])

  useEffect(() => {
    if (!composeMode) return
    const t = setTimeout(() => {
      try { document.getElementById('feed-compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch { /* ignore */ }
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
    } finally { setFollowBusyId(null) }
  }

  const empty = useMemo(() => !loading && !error && posts.length === 0, [loading, error, posts.length])

  const leftSuggestedSection = (
    <div className="rounded-2xl border border-stone-200/60 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-stone-900">Suggested to Follow</div>
      </div>
      {suggestedLoading ? (
        <div className="mt-3 text-sm text-stone-500">Loading…</div>
      ) : suggested.length === 0 ? (
        <div className="mt-3 text-sm text-stone-500">No suggestions right now.</div>
      ) : (
        <div className="mt-2 divide-y divide-stone-100">
          {suggested.slice(0, 5).map((u) => (
            <SuggestedUserRow key={u.id} user={u} onFollow={follow} busy={followBusyId === u.id} />
          ))}
        </div>
      )}
      <Link to="/people" className="mt-3 flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900">
        See All <span aria-hidden>&gt;</span>
      </Link>
    </div>
  )

  return (
    <FeedLayout leftSuggestedSection={leftSuggestedSection}>
      <div className="space-y-4">
        <div id="feed-compose">
          <CreatePostCard
            viewerId={viewerId}
            userPic={user?.profile_pic}
            onPosted={() => loadFeed()}
            autoFocus={composeMode}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-stone-500">Topic:</span>
            {TOPIC_CHIPS.map(({ slug, label }) => (
              <Link
                key={slug || 'all'}
                to={slug ? `/feed?topic=${encodeURIComponent(slug)}` : '/feed'}
                className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  topicSlug === slug
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
          <Select
            value={feedSort}
            onChange={(e) => {
              const v = e.target.value
              const next = new URLSearchParams(params)
              if (v === 'newest') next.set('sort', 'newest')
              else next.delete('sort')
              setParams(next, { replace: true })
            }}
            className="w-auto min-w-[10rem] text-xs text-stone-600"
          >
            <option value="top">Top (engagement)</option>
            <option value="newest">Newest first</option>
          </Select>
        </div>

        {showNewPostsBanner && !loading && (
          <button
            type="button"
            onClick={() => loadFeed()}
            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            New posts available — tap to refresh
          </button>
        )}

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-stone-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-stone-200" />
                    <div className="h-2.5 w-20 rounded bg-stone-100" />
                  </div>
                </div>
                <div className="mt-4 h-3 w-3/4 rounded bg-stone-100" />
                <div className="mt-2 h-40 rounded-xl bg-stone-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <div className="text-sm text-red-700">{error}</div>
            <Button variant="secondary" className="mt-3" onClick={() => loadFeed()}>Retry</Button>
          </div>
        ) : empty ? (
          <div className="rounded-2xl border border-stone-200/60 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
              <svg className="h-8 w-8 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="text-sm font-semibold text-stone-800">Your feed is empty</div>
            <p className="mt-1 text-sm text-stone-500">Follow people to see their posts here.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link to="/people"><Button>Find people</Button></Link>
              <Button variant="secondary" onClick={() => { logout(); navigate('/login?reason=session&next=/feed', { replace: true }) }}>
                Re-login
              </Button>
            </div>
          </div>
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
