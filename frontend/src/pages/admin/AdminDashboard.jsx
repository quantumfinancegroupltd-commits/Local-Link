import { useEffect, useState } from 'react'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/admin/users')
        if (!cancelled) setUsers(Array.isArray(res.data) ? res.data : res.data?.users ?? [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load users')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function verifyUser(id) {
    setBusyId(id)
    try {
      await http.put(`/admin/users/${id}/verify`)
      const res = await http.get('/admin/users')
      setUsers(Array.isArray(res.data) ? res.data : res.data?.users ?? [])
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-slate-600">Verify users and monitor activity (Phase 1 UI).</p>
      </div>

      <Card>
        <div className="text-sm font-semibold">Users</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : users.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No users found.</div>
        ) : (
          <div className="mt-3 divide-y">
            {users.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold">{u.name || u.email}</div>
                  <div className="text-xs text-slate-600">
                    {u.role} • {u.verified ? 'verified' : 'not verified'}
                  </div>
                </div>
                {!u.verified ? (
                  <Button disabled={busyId === u.id} onClick={() => verifyUser(u.id)}>
                    {busyId === u.id ? 'Verifying…' : 'Verify'}
                  </Button>
                ) : (
                  <Button variant="secondary" disabled>
                    Verified
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}


