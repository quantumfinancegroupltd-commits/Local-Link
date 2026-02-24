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

// Role-based default images for job cards when job has no image_url
const jobCardDefaults = {
  retail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70',
  warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=240&fit=crop&q=70',
  supervisor: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70', // retail store
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=240&fit=crop&q=70',
  default: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=240&fit=crop&q=70',
}
function getDefaultJobImage(job) {
  const t = String((job?.title || '') + ' ' + (job?.employment_type || '')).toLowerCase()
  if (/\b(retail|store|sales|associate|shop)\b/.test(t)) return jobCardDefaults.retail
  if (/\b(warehouse|packer|packing|logistics|inventory)\b/.test(t)) return jobCardDefaults.warehouse
  if (/\b(supervisor|manager|operations|team lead)\b/.test(t)) return jobCardDefaults.supervisor
  if (/\b(office|admin|coordinator)\b/.test(t)) return jobCardDefaults.office
  return jobCardDefaults.default
}

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

  // Must run unconditionally (same number of hooks every render) — cannot be after early returns
  const c = data?.company
  usePageMeta({
    title: c?.name ? `${c.name} • LocalLink` : 'Company • LocalLink',
    description: (c?.description || ownerProfile?.profile?.bio || ownerProfile?.user?.company_description)
      ? String(c?.description || ownerProfile?.profile?.bio || ownerProfile?.user?.company_description).slice(0, 160)
      : (c?.name ? `View ${c.name} on LocalLink.` : 'Company on LocalLink.'),
    image: c?.cover_url || c?.logo_url || ownerProfile?.user?.profile_pic || ownerProfile?.profile?.cover_photo || '/locallink-logo.png',
    url: typeof window !== 'undefined' && slug ? `${window.location.origin}/c/${encodeURIComponent(slug)}` : null,
    type: 'profile',
  })

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

  const company = data.company
  const jobs = Array.isArray(data.jobs) ? data.jobs : []
  const isOwner = Boolean(viewerCompanySlug && String(viewerCompanySlug) === String(slug))
  const jobsPreview = jobs.slice(0, 4)
  const ownerId = company?.owner_user_id ? String(company.owner_user_id) : ''
  const owner = ownerProfile?.user ?? null
  const stats = ownerProfile?.stats ?? null
  const ownerProfileData = ownerProfile?.profile ?? null
  // Fall back to owner profile when company has no cover/logo/bio
  const coverUrl = company?.cover_url || owner?.company_cover_url || ownerProfileData?.cover_photo
  const logoUrl = company?.logo_url || owner?.profile_pic
  const description = company?.description || ownerProfileData?.bio || owner?.company_description

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
        title: company?.name ? `${company.name} • LocalLink` : 'LocalLink',
        text: description ? String(description).slice(0, 160) : `${company.name || 'Company'} • LocalLink`,
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
                <div className="text-lg font-bold">{company.name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  <span className="font-semibold">COMPANY</span>
                  {(typeof owner?.rating === 'number' || owner?.rating != null) ? (
                    <> • Rating {Number(owner?.rating ?? 0).toFixed(1)}</>
                  ) : null}
                  {owner?.verified ? ' • Verified' : ''}
                </div>
                {(company.industry || company.location || company.size_range) ? (
                  <div className="mt-0.5 text-xs text-slate-500">
                    {company.industry || 'Company'}
                    {company.location ? ` • ${company.location}` : ''}
                    {company.size_range ? ` • ${company.size_range}` : ''}
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
        subtitle={isOwner ? 'Updates from your company page.' : `Updates from ${company.name}.`}
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
            {jobsPreview.map((j) => {
              const jobImgSrc = j.image_url
                ? (j.image_url.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${j.image_url}` : j.image_url)
                : getDefaultJobImage(j)
              return (
            <Card key={j.id} className="p-0 overflow-hidden">
              <div className="relative h-32 w-full bg-slate-100">
                <img src={jobImgSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              <div className="p-5">
                <div className="text-sm font-semibold text-slate-900">{j.title}</div>
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
              </div>
            </Card>
              )
            })}
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

