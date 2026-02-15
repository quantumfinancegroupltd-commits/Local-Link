import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { TrustBadge } from '../../components/ui/TrustBadge.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { SocialPostCard } from '../../components/social/SocialPostCard.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { FollowListModal } from '../../components/social/FollowListModal.jsx'

export function CompanyPublic() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null) // { company, jobs }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()
  const { isAuthed, user } = useAuth()
  const [viewerCompanySlug, setViewerCompanySlug] = useState(null)
  const viewerId = user?.id ?? null

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsError, setPostsError] = useState(null)

  const [followInfo, setFollowInfo] = useState(null) // {followers, following, viewer_following, viewer_requested}
  const [followBusy, setFollowBusy] = useState(false)
  const [ownerProfile, setOwnerProfile] = useState(null) // { user, stats } from profile API
  const [followModal, setFollowModal] = useState(null) // 'followers' | 'following' | null

  async function reloadPosts() {
    const ownerId = data?.company?.owner_user_id ? String(data.company.owner_user_id) : ''
    if (!ownerId) {
      setPosts([])
      return
    }
    setPostsLoading(true)
    setPostsError(null)
    try {
      const r = await http.get(`/posts/user/${encodeURIComponent(ownerId)}`)
      setPosts(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setPostsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load posts')
      setPosts([])
    } finally {
      setPostsLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadCompanyPosts() {
      const ownerId = data?.company?.owner_user_id ? String(data.company.owner_user_id) : ''
      if (!ownerId) {
        if (!cancelled) {
          setPosts([])
          setPostsError(null)
          setPostsLoading(false)
        }
        return
      }
      if (!cancelled) {
        setPostsLoading(true)
        setPostsError(null)
      }
      try {
        const r = await http.get(`/posts/user/${encodeURIComponent(ownerId)}`)
        if (!cancelled) setPosts(Array.isArray(r.data) ? r.data : [])
      } catch (e) {
        if (!cancelled) {
          setPostsError(e?.response?.data?.message ?? e?.message ?? 'Failed to load posts')
          setPosts([])
        }
      } finally {
        if (!cancelled) setPostsLoading(false)
      }
    }
    loadCompanyPosts()
    return () => {
      cancelled = true
    }
  }, [slug, data?.company?.owner_user_id])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setOwnerProfile(null)
      try {
        const res = await http.get(`/corporate/companies/${encodeURIComponent(slug)}`)
        if (cancelled) return
        const company = res.data?.company ?? null
        if (!company) {
          if (!cancelled) setError('Company not found')
          return
        }
        if (!cancelled) setData(res.data ?? null)

        // Fetch owner profile for Trust score, Rating, reviews, posts
        const ownerId = company?.owner_user_id ? String(company.owner_user_id) : ''
        if (ownerId) {
          try {
            const pr = await http.get(`/profile/${encodeURIComponent(ownerId)}`)
            if (!cancelled) setOwnerProfile(pr.data ?? null)
          } catch {
            // Profile may be private; continue without owner profile data
            if (!cancelled) setOwnerProfile(null)
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Company not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    async function loadViewerCompany() {
      if (!isAuthed || user?.role !== 'company') {
        setViewerCompanySlug(null)
        return
      }
      try {
        const r = await http.get('/corporate/company/me')
        const s = r.data?.slug ? String(r.data.slug) : ''
        if (!cancelled) setViewerCompanySlug(s || null)
      } catch {
        if (!cancelled) setViewerCompanySlug(null)
      }
    }
    loadViewerCompany()
    return () => {
      cancelled = true
    }
  }, [isAuthed, user?.role])

  useEffect(() => {
    let cancelled = false
    async function loadFollowInfo() {
      const ownerId = data?.company?.owner_user_id ? String(data.company.owner_user_id) : ''
      if (!ownerId) {
        if (!cancelled) setFollowInfo(null)
        return
      }
      try {
        const r = await http.get(`/follows/${encodeURIComponent(ownerId)}`)
        if (!cancelled) setFollowInfo(r.data ?? null)
      } catch {
        if (!cancelled) setFollowInfo(null)
      }
    }
    loadFollowInfo()
    return () => {
      cancelled = true
    }
  }, [data?.company?.owner_user_id, isAuthed])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>Loading…</Card>
      </div>
    )
  }
  if (error || !data?.company) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card className="p-5">
          <div className="text-sm text-red-700">{error || 'Company not found'}</div>
          <div className="mt-3">
            <Link to="/jobs">
              <Button variant="secondary">Browse jobs</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const c = data.company
  const jobs = Array.isArray(data.jobs) ? data.jobs : []
  const isOwner = Boolean(viewerCompanySlug && String(viewerCompanySlug) === String(slug))
  const jobsPreview = jobs.slice(0, 4)
  const ownerId = c?.owner_user_id ? String(c.owner_user_id) : ''
  const owner = ownerProfile?.user ?? null
  const stats = ownerProfile?.stats ?? null
  const ownerProfileData = ownerProfile?.profile ?? null
  // Fall back to owner profile when company has no cover/logo/bio
  const coverUrl = c?.cover_url || owner?.company_cover_url || ownerProfileData?.cover_photo
  const logoUrl = c?.logo_url || owner?.profile_pic
  const description = c?.description || ownerProfileData?.bio || owner?.company_description

  const lastActiveLabel = (() => {
    const raw = owner?.last_active_at
    if (!raw) return null
    const t = new Date(raw).getTime()
    if (!Number.isFinite(t)) return null
    const days = Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)))
    if (days === 0) return 'Active today'
    if (days === 1) return 'Active 1 day ago'
    return `Active ${days} days ago`
  })()

  const verificationTier = String(owner?.verification_tier ?? 'unverified')

  usePageMeta({
    title: c?.name ? `${c.name} • LocalLink` : 'Company • LocalLink',
    description: description ? String(description).slice(0, 160) : `View ${c?.name || 'company'} on LocalLink.`,
    image: coverUrl || logoUrl || '/locallink-logo.png',
    url: typeof window !== 'undefined' ? `${window.location.origin}/c/${encodeURIComponent(slug)}` : null,
    type: 'profile',
  })

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/c/${encodeURIComponent(slug)}` : ''

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(publicUrl || window.location.href)
      toast.push({ title: 'Link copied', variant: 'success' })
    } catch {
      toast.push({ title: 'Could not copy link', description: 'Your browser blocked clipboard access.', variant: 'error' })
    }
  }

  async function nativeShare() {
    try {
      if (!navigator.share) return copyShareLink()
      await navigator.share({
        title: c?.name ? `${c.name} • LocalLink` : 'LocalLink',
        text: description ? String(description).slice(0, 160) : 'LocalLink company page',
        url: publicUrl || window.location.href,
      })
    } catch {
      // ignore (user cancelled)
    }
  }

  async function toggleFollowOwner() {
    if (!ownerId) return
    if (!isAuthed) return toast.warning('Login required', 'Please login to follow companies.')
    if (viewerId && String(viewerId) === String(ownerId)) return
    if (followInfo?.viewer_requested) return
    setFollowBusy(true)
    try {
      if (followInfo?.viewer_following) await http.delete(`/follows/${encodeURIComponent(ownerId)}`)
      else await http.post(`/follows/${encodeURIComponent(ownerId)}`)
      const r = await http.get(`/follows/${encodeURIComponent(ownerId)}`).catch(() => ({ data: null }))
      setFollowInfo(r.data ?? null)
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed')
    } finally {
      setFollowBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <FollowListModal
        open={!!followModal}
        onClose={() => setFollowModal(null)}
        userId={ownerId}
        viewerId={viewerId}
        initialTab={followModal ?? 'followers'}
        onCountsChange={async () => {
          const r = await http.get(`/follows/${encodeURIComponent(ownerId)}`).catch(() => ({ data: null }))
          setFollowInfo(r.data ?? null)
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate(-1)} className="text-sm font-semibold text-slate-700 hover:text-slate-900">
          Back
        </button>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copyShareLink}>
            Copy link
          </Button>
          <Button onClick={nativeShare}>Share</Button>
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="relative h-48 bg-slate-200">
          {coverUrl ? <img src={coverUrl} alt="cover" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/10 to-black/40" />
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              {logoUrl ? <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-2xl border object-cover" /> : null}
              <div>
                <div className="text-lg font-bold">{c.name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  <span className="font-semibold">COMPANY</span>
                  {(typeof owner?.rating === 'number' || owner?.rating != null) ? (
                    <> • Rating {Number(owner?.rating ?? 0).toFixed(1)}</>
                  ) : null}
                  {owner?.verified ? ' • Verified' : ''}
                </div>
                {(c.industry || c.location || c.size_range) ? (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {c.industry || 'Company'}
                    {c.location ? ` • ${c.location}` : ''}
                    {c.size_range ? ` • ${c.size_range}` : ''}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <TrustBadge trustScore={owner?.trust_score} />
                  {followInfo ? (
                    <button
                      type="button"
                      onClick={() => setFollowModal('followers')}
                      className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                    >
                      {Number(followInfo.followers ?? 0)} followers • {Number(followInfo.following ?? 0)} following
                    </button>
                  ) : null}
                  {lastActiveLabel ? (
                    <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">{lastActiveLabel}</span>
                  ) : null}
                  <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {verificationTier === 'unverified' ? 'Unverified' : `Verification: ${verificationTier.toUpperCase()}`}
                  </span>
                  {typeof stats?.verified_reviews === 'number' ? (
                    <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {stats.verified_reviews} verified reviews
                    </span>
                  ) : typeof stats?.reviews === 'number' ? (
                    <span className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                      {stats.reviews} reviews
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
            <div className="flex flex-wrap gap-2">
              {isOwner ? (
                <Link to="/company">
                  <Button variant="secondary">Edit profile</Button>
                </Link>
              ) : (
                <Button
                  variant={followInfo?.viewer_following || followInfo?.viewer_requested ? 'secondary' : 'primary'}
                  disabled={followBusy || followInfo?.viewer_requested}
                  onClick={toggleFollowOwner}
                  title={followInfo?.viewer_requested ? 'Follow request pending approval' : undefined}
                >
                  {followBusy ? 'Working…' : followInfo?.viewer_requested ? 'Requested' : followInfo?.viewer_following ? 'Following' : 'Follow'}
                </Button>
              )}
              <Link to={`/jobs?company=${encodeURIComponent(slug)}`}>
                <Button variant="secondary">View all jobs</Button>
              </Link>
            </div>
          </div>
          {description ? <div className="mt-4 whitespace-pre-wrap text-sm text-slate-800">{description}</div> : null}
        </div>
      </Card>

      <PageHeader
        title="Posts"
        subtitle={isOwner ? 'Updates from your company page.' : `Updates from ${c.name}.`}
        actions={
          isOwner ? (
            <Link to="/feed?compose=1">
              <Button variant="secondary">Post an update</Button>
            </Link>
          ) : null
        }
      />
      {postsLoading ? (
        <Card className="p-5">Loading…</Card>
      ) : postsError ? (
        <Card className="p-5">
          <div className="text-sm text-red-700">{postsError}</div>
        </Card>
      ) : posts.length === 0 ? (
        <Card className="p-5">
          <div className="text-sm text-slate-600">No posts yet.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <SocialPostCard key={p.id} post={p} viewerId={viewerId} onRefresh={reloadPosts} />
          ))}
        </div>
      )}

      <PageHeader title="Open roles" subtitle="Apply directly on LocalLink." />
      {jobs.length === 0 ? (
        <Card className="p-5">
          <div className="text-sm text-slate-600">No open jobs right now.</div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {jobsPreview.map((j) => (
            <Card key={j.id} className="p-5">
              <div className="text-sm font-semibold">{j.title}</div>
              <div className="mt-1 text-xs text-slate-600">
                {j.location ? `${j.location} • ` : ''}
                {j.employment_type ? String(j.employment_type).replaceAll('_', ' ') : ''}
                {j.work_mode ? ` • ${j.work_mode}` : ''}
              </div>
              <div className="mt-3">
                <Link to={`/jobs/${j.id}`}>
                  <Button>View & apply</Button>
                </Link>
              </div>
            </Card>
            ))}
          </div>
          {jobs.length > jobsPreview.length ? (
            <div className="pt-2">
              <Link to={`/jobs?company=${encodeURIComponent(slug)}`}>
                <Button variant="secondary">View all jobs ({jobs.length})</Button>
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

