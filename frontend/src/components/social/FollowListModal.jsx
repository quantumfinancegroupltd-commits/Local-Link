import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card } from '../ui/FormControls.jsx'
import { Tabs } from '../ui/Tabs.jsx'
import { useToast } from '../ui/Toast.jsx'

function roleTag(role) {
  const r = String(role || '')
  if (!r) return ''
  if (r === 'buyer') return 'Buyer'
  if (r === 'artisan') return 'Provider'
  if (r === 'farmer') return 'Farmer / Florist'
  if (r === 'driver') return 'Driver'
  if (r === 'company') return 'Company'
  return r.toUpperCase()
}

function profileLinkForUser(u) {
  if (!u?.id) return '/people'
  const slug = u?.company_slug ? String(u.company_slug).trim() : ''
  if (slug) return `/c/${encodeURIComponent(slug)}`
  return `/u/${encodeURIComponent(u.id)}`
}

export function FollowListModal({ open, onClose, userId, viewerId, initialTab = 'followers', onCountsChange }) {
  const toast = useToast()
  const { isAuthed } = useAuth()
  const [tab, setTab] = useState(initialTab) // followers | following
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [nextBefore, setNextBefore] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadFirst() {
      setLoading(true)
      setError(null)
      try {
        const path = tab === 'following' ? `/follows/user/${encodeURIComponent(userId)}/following` : `/follows/user/${encodeURIComponent(userId)}/followers`
        const r = await http.get(path, { params: { limit: 24 } })
        if (cancelled) return
        setItems(Array.isArray(r.data?.items) ? r.data.items : [])
        setNextBefore(r.data?.next_before ?? null)
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadFirst()
    return () => {
      cancelled = true
    }
  }, [open, tab, userId])

  async function loadMore() {
    if (!nextBefore) return
    setLoading(true)
    setError(null)
    try {
      const path = tab === 'following' ? `/follows/user/${encodeURIComponent(userId)}/following` : `/follows/user/${encodeURIComponent(userId)}/followers`
      const r = await http.get(path, { params: { limit: 24, before: nextBefore } })
      const more = Array.isArray(r.data?.items) ? r.data.items : []
      setItems((prev) => [...(prev || []), ...more])
      setNextBefore(r.data?.next_before ?? null)
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load more')
    } finally {
      setLoading(false)
    }
  }

  async function toggleFollowRow(row) {
    if (!isAuthed) {
      toast.warning('Login required', 'Please login to follow people.')
      return
    }
    if (!row?.id || (viewerId && String(row.id) === String(viewerId))) return
    setBusyId(row.id)
    try {
      if (row.viewer_following) await http.delete(`/follows/${encodeURIComponent(row.id)}`)
      else await http.post(`/follows/${encodeURIComponent(row.id)}`)
      if (typeof onCountsChange === 'function') await onCountsChange()
      const path = tab === 'following' ? `/follows/user/${encodeURIComponent(userId)}/following` : `/follows/user/${encodeURIComponent(userId)}/followers`
      const r = await http.get(path, { params: { limit: 24 } })
      setItems(Array.isArray(r.data?.items) ? r.data.items : [])
      setNextBefore(r.data?.next_before ?? null)
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close followers modal" />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div className="text-sm font-semibold">{tab === 'following' ? 'Following' : 'Followers'}</div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="px-5 py-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'followers', label: 'Followers' },
                { value: 'following', label: 'Following' },
              ]}
            />

            {loading && items.length === 0 ? (
              <div className="mt-4 text-sm text-slate-600">Loading…</div>
            ) : error ? (
              <div className="mt-4 text-sm text-red-700">{error}</div>
            ) : items.length === 0 ? (
              <div className="mt-4 text-sm text-slate-600">No users yet.</div>
            ) : (
              <div className="mt-4 space-y-2">
                {items.map((p) => {
                  const to = profileLinkForUser(p)
                  const canToggle = isAuthed && viewerId && String(p.id) !== String(viewerId)
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3">
                      <Link to={to} onClick={onClose} className="flex min-w-0 items-center gap-3">
                        <img src={p?.profile_pic || '/locallink-logo.png'} alt="avatar" className="h-10 w-10 rounded-2xl border object-cover" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{p?.name || 'User'}</div>
                          <div className="mt-0.5 text-xs text-slate-500">{roleTag(p?.role)}</div>
                        </div>
                      </Link>
                      {canToggle ? (
                        <Button
                          size="sm"
                          variant={p.viewer_following ? 'secondary' : 'primary'}
                          disabled={busyId === p.id}
                          onClick={() => toggleFollowRow(p)}
                        >
                          {busyId === p.id ? 'Working…' : p.viewer_following ? 'Following' : 'Follow'}
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
                <div className="pt-2">
                  {nextBefore ? (
                    <Button variant="secondary" disabled={loading} onClick={loadMore}>
                      {loading ? 'Loading…' : 'Load more'}
                    </Button>
                  ) : (
                    <div className="text-xs text-slate-500">End of list</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

