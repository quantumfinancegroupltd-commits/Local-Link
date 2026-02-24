import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { http } from '../api/http.js'
import { Button, Card } from '../components/ui/FormControls.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { enablePushNotifications, isPushSupported } from '../lib/push.js'

function timeAgo(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const ms = Date.now() - d.getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

export function Notifications() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [busyAll, setBusyAll] = useState(false)
  const [pushStatus, setPushStatus] = useState(null) // null | 'enabling' | 'enabled' | { error }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await http.get('/notifications?limit=60')
      setItems(Array.isArray(r.data?.items) ? r.data.items : [])
      setUnreadCount(Number(r.data?.unreadCount ?? 0))
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const hasUnread = useMemo(() => unreadCount > 0, [unreadCount])

  async function markAllRead() {
    setBusyAll(true)
    try {
      await http.post('/notifications/read_all')
      await load()
    } finally {
      setBusyAll(false)
    }
  }

  async function markRead(id) {
    try {
      await http.post(`/notifications/${id}/read`)
      setItems((arr) => arr.map((n) => (String(n.id) === String(id) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)))
      setUnreadCount((c) => Math.max(0, Number(c) - 1))
    } catch {
      // best-effort (ignore)
    }
  }

  async function open(n) {
    await markRead(n.id)
    const url = n?.meta?.url
    if (url) navigate(url)
  }

  async function onEnablePush() {
    setPushStatus('enabling')
    const result = await enablePushNotifications()
    if (result.ok) setPushStatus('enabled')
    else setPushStatus({ error: result.error })
  }

  const pushSupported = isPushSupported()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Notifications"
        subtitle={hasUnread ? `${unreadCount} unread` : 'All caught up'}
        actions={
          <>
            <Button variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={markAllRead} disabled={!hasUnread || busyAll}>
              {busyAll ? 'Marking…' : 'Mark all read'}
            </Button>
            <Link to="/">
              <Button variant="secondary">Back</Button>
            </Link>
          </>
        }
      />

      {pushSupported && (
        <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium text-slate-900">Browser push notifications</div>
            <div className="text-sm text-slate-600">
              Get notified when you’re not on the site — new messages, orders, or job updates.
            </div>
          </div>
          <div className="shrink-0">
            {pushStatus === 'enabled' ? (
              <span className="text-sm font-medium text-emerald-600">Push enabled</span>
            ) : pushStatus?.error ? (
              <div className="flex flex-col gap-1">
                <Button variant="secondary" onClick={onEnablePush}>Try again</Button>
                <span className="text-xs text-red-600">{pushStatus.error}</span>
              </div>
            ) : (
              <Button
                variant="primary"
                onClick={onEnablePush}
                disabled={pushStatus === 'enabling'}
              >
                {pushStatus === 'enabling' ? 'Enabling…' : 'Enable push notifications'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <EmptyState title="Couldn’t load notifications" description={error} actions={<Button onClick={load}>Try again</Button>} />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications yet" description="When something important happens, you’ll see it here." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="divide-y">
            {items.map((n) => {
              const unread = !n.read_at
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => open(n)}
                  className={[
                    'w-full text-left px-5 py-4 hover:bg-slate-50',
                    unread ? 'bg-emerald-50/40' : 'bg-white',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {unread ? <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" /> : null}
                        <div className="truncate text-sm font-semibold text-slate-900">{n.title || 'Notification'}</div>
                      </div>
                      {n.body ? <div className="mt-1 text-sm text-slate-700">{n.body}</div> : null}
                      <div className="mt-2 text-xs text-slate-500">{timeAgo(n.created_at)}</div>
                    </div>
                    {unread ? (
                      <div className="shrink-0">
                        <span className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          New
                        </span>
                      </div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}


