import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function MyCompanyPublicRedirect() {
  const [slug, setSlug] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await http.get('/corporate/company/me')
        const s = r.data?.slug ? String(r.data.slug) : ''
        if (!cancelled) setSlug(s || null)
      } catch {
        if (!cancelled) setSlug(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (slug) return <Navigate to={`/c/${encodeURIComponent(slug)}`} replace />

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>Loading…</Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-5">
        <div className="text-sm font-semibold">Public company page</div>
        <div className="mt-2 text-sm text-slate-600">
          You don’t have a company page yet. Create your company profile first, then you’ll get a public page like LinkedIn.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/company">
            <Button>Create / edit company profile</Button>
          </Link>
          <Link to="/jobs">
            <Button variant="secondary">Browse jobs</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

