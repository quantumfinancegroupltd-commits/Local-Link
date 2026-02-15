import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'

export function MessagesInbox() {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await http.get('/messages/inbox')
      if (!mountedRef.current) return
      setThreads(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      if (!mountedRef.current) return
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load inbox')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => {
      mountedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Chat with buyers, sellers, and drivers."
        actions={
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {loading ? (
        <Card className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Messages will appear when you start a conversation from a job or an order."
          actions={
            <>
              <Link to="/buyer/jobs/new">
                <Button>Post a job</Button>
              </Link>
              <Link to="/marketplace">
                <Button variant="secondary">Browse produce</Button>
              </Link>
            </>
          }
        />
      ) : (
        <Card className="p-0">
          <div className="divide-y">
            {threads.map((t) => {
              const to =
                t.context_type === 'job'
                  ? `/messages/job/${t.context_id}`
                  : t.context_type === 'order'
                    ? `/messages/order/${t.context_id}`
                    : `/messages/jobpost/${t.context_id}?with=${encodeURIComponent(t.other_user_id)}`
              return (
                <Link
                  key={`${t.context_type}-${t.context_id}-${t.other_user_id}`}
                  to={to}
                  className="block px-5 py-4 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {t.other_name || t.other_email || 'User'}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm text-slate-700">{t.last_message}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {String(t.context_type || '').toUpperCase()} • {new Date(t.last_at).toLocaleString()}
                      </div>
                    </div>
                    {Number(t.unread_count ?? 0) > 0 ? (
                      <div className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">{t.unread_count}</div>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}


