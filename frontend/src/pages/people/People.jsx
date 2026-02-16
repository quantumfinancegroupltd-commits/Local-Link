import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { getRoleLabel } from '../../lib/roles.js'

function profileLinkForUser(u) {
  if (!u?.id) return '/people'
  const slug = u?.company_slug ? String(u.company_slug).trim() : ''
  if (slug) return `/c/${encodeURIComponent(slug)}`
  return `/u/${encodeURIComponent(u.id)}`
}

function PersonRow({ person, onToggleFollow, busy }) {
  const to = profileLinkForUser(person)
  const following = !!person.viewer_following
  const requested = !!person.viewer_requested
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
      <Link to={to} className="flex min-w-0 items-center gap-3">
        <img src={person?.profile_pic || '/locallink-logo.png'} alt="avatar" className="h-12 w-12 rounded-2xl border object-cover" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{person?.name || 'User'}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="rounded-full border bg-slate-50 px-2 py-0.5 font-semibold">{getRoleLabel(person?.role)}</span>
            <span className="text-slate-400">•</span>
            <span>
              <span className="font-semibold">{Number(person?.followers ?? 0)}</span> followers
            </span>
          </div>
        </div>
      </Link>

      <div className="flex items-center gap-2">
        <Link to={to}>
          <Button variant="secondary" size="sm">
            View
          </Button>
        </Link>
        <Button
          size="sm"
          variant={following || requested ? 'secondary' : 'primary'}
          disabled={busy || requested}
          onClick={() => onToggleFollow(person)}
          title={requested ? 'Follow request pending approval' : undefined}
        >
          {busy ? 'Working…' : requested ? 'Requested' : following ? 'Following' : 'Follow'}
        </Button>
      </div>
    </div>
  )
}

export function People() {
  usePageMeta({ title: 'People • LocalLink', description: 'Find and follow people on LocalLink.' })

  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const params = useMemo(() => {
    const p = {}
    if (q.trim()) p.q = q.trim()
    if (role) p.role = role
    p.limit = 40
    return p
  }, [q, role])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await http.get('/follows/people/list', { params })
      setItems(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load people')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, params.role])

  async function toggleFollow(person) {
    if (person?.viewer_requested) return
    setBusyId(person.id)
    try {
      if (person.viewer_following) {
        await http.delete(`/follows/${encodeURIComponent(person.id)}`)
        toast.success('Unfollowed.')
      } else {
        const r = await http.post(`/follows/${encodeURIComponent(person.id)}`)
        if (r.data?.pending) toast.success('Request sent', 'Waiting for approval.')
        else toast.success('Following.')
      }
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader kicker="Community" title="People" subtitle="Search and follow accounts to curate your Feed." />

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label>Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All</option>
              <option value="buyer">Buyers</option>
              <option value="artisan">Providers (Artisans)</option>
              <option value="farmer">Farmers / Florists</option>
              <option value="driver">Drivers</option>
              <option value="company">Companies</option>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Link to="/feed">
            <Button variant="secondary">Back to feed</Button>
          </Link>
        </div>
      </Card>

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-600">No matches.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <PersonRow key={p.id} person={p} busy={busyId === p.id} onToggleFollow={toggleFollow} />
          ))}
        </div>
      )}
    </div>
  )
}

