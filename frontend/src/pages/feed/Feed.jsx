import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'
import { SocialPostCard } from '../../components/social/SocialPostCard.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { useDraftAutosave } from '../../lib/drafts.js'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'

function CreatePostCard({ viewerId, onPosted, autoFocus = false }) {
  const toast = useToast()
  const { online } = useOnlineStatus()
  const textRef = useRef(null)

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
          ref={textRef}
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          rows={3}
          placeholder="Share an update, new hire, team win, behind-the-scenes…"
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

export function Feed() {
  usePageMeta({ title: 'Feed • LocalLink', description: 'Updates from people you follow.' })

  const toast = useToast()
  const { user } = useAuth()
  const viewerId = user?.id ?? null
  const [params] = useSearchParams()
  const compose = String(params.get('compose') || '').toLowerCase()
  const composeMode = compose === '1' || compose === 'true' || compose === 'yes'

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [suggested, setSuggested] = useState([])
  const [suggestedLoading, setSuggestedLoading] = useState(true)
  const [followBusyId, setFollowBusyId] = useState(null)

  async function loadFeed() {
    setLoading(true)
    setError(null)
    try {
      const r = await http.get('/posts/feed')
      setPosts(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load feed')
    } finally {
      setLoading(false)
    }
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
  }, [])

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader kicker="Community" title="Feed" subtitle="Posts from people you follow (and your own posts)." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div id="feed-compose">
            <CreatePostCard viewerId={viewerId} onPosted={loadFeed} autoFocus={composeMode} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">Tip: follow providers or friends to curate this feed.</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={loadFeed} disabled={loading}>
                Refresh
              </Button>
              <Link to="/people">
                <Button variant="secondary">Find people</Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <Card>Loading…</Card>
          ) : error ? (
            <Card>
              <div className="text-sm text-red-700">{error}</div>
            </Card>
          ) : empty ? (
            <Card>
              <div className="text-sm text-slate-600">Your feed is empty. Follow someone, then come back.</div>
            </Card>
          ) : (
            posts.map((p) => <SocialPostCard key={p.id} post={p} viewerId={viewerId} onRefresh={loadFeed} />)
          )}
        </div>

        <div className="space-y-4 lg:col-span-1">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Suggested</div>
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
          </Card>
        </div>
      </div>
    </div>
  )
}

