import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function FarmerDashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get('/products')
        if (!cancelled) setProducts(Array.isArray(res.data) ? res.data : res.data?.products ?? [])
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load products')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Farmer Dashboard</h1>
          <p className="text-sm text-slate-600">List produce and track buyer orders (Phase 1 UI).</p>
        </div>
        <Link to="/farmer/products/new">
          <Button>List Produce</Button>
        </Link>
      </div>

      <Card>
        <div className="text-sm font-semibold">My Listings</div>
        {loading ? (
          <div className="mt-3 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-3 text-sm text-red-700">{error}</div>
        ) : products.length === 0 ? (
          <div className="mt-3 text-sm text-slate-600">No listings yet.</div>
        ) : (
          <div className="mt-3 divide-y">
            {products.map((p) => (
              <div key={p.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{p.name || 'Product'}</div>
                    <div className="text-xs text-slate-600">
                      {p.quantity ?? '—'} {p.unit ?? ''} • {p.category ?? '—'}
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-700">{p.status || 'available'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}


