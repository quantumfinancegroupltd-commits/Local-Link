import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../ui/FormControls.jsx'
import { useToast } from '../ui/Toast.jsx'

function profileLinkForLiker(u) {
  if (!u?.id) return '/people'
  return `/u/${encodeURIComponent(u.id)}`
}

function roleLabel(role) {
  const r = String(role || '')
  if (!r) return ''
  if (r === 'artisan') return 'Provider'
  if (r === 'farmer') return 'Farmer / Florist'
  if (r === 'driver') return 'Driver'
  if (r === 'company') return 'Company'
  if (r === 'buyer') return 'Buyer'
  return r.charAt(0).toUpperCase() + r.slice(1)
}

export function LikersModal({ open, onClose, postId }) {
  const toast = useToast()
  const [likers, setLikers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !postId) return
    let cancelled = false
    setLoading(true)
    setLikers([])
    http
      .get(`/posts/${postId}/likes`)
      .then((r) => {
        if (!cancelled) setLikers(Array.isArray(r.data) ? r.data : [])
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to load likers')
          setLikers([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, postId, toast])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close likers" />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="text-sm font-semibold">Liked by</div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="text-sm text-slate-600">Loading…</div>
            ) : likers.length === 0 ? (
              <div className="text-sm text-slate-600">No likes yet.</div>
            ) : (
              <div className="space-y-2">
                {likers.map((u) => (
                  <Link
                    key={u.id}
                    to={profileLinkForLiker(u)}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl border bg-white p-3 text-left hover:bg-slate-50"
                  >
                    {u?.profile_pic ? (
                      <img src={u.profile_pic} alt="" className="h-10 w-10 shrink-0 rounded-2xl border object-cover" />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-2xl border bg-slate-100" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{u?.name || 'User'}</div>
                      <div className="text-xs text-slate-500">{roleLabel(u?.role)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
