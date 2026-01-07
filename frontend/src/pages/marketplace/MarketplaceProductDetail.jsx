import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { VerificationBadge } from '../../components/ui/VerificationBadge.jsx'

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

export function MarketplaceProductDetail() {
  const { id } = useParams()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [placed, setPlaced] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get(`/products/${id}`)
        if (!cancelled) setProduct(res.data?.product ?? res.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load product')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const total = useMemo(() => {
    const price = Number(product?.price ?? 0)
    const q = Number(qty ?? 0)
    return Number.isFinite(price * q) ? price * q : 0
  }, [product?.price, qty])

  const img = useMemo(
    () => pick(product, ['image_url', 'imageUrl', 'photo_url', 'photoUrl', 'thumbnail_url', 'thumbnailUrl']),
    [product],
  )
  const verifyEntity =
    product?.farmer ??
    product?.farmer_profile ??
    product?.farmerProfile ??
    product?.farmer_user ??
    product?.farmerUser ??
    product

  async function placeOrder(e) {
    e.preventDefault()
    setOrderError(null)
    setBusy(true)
    try {
      await http.post('/orders', {
        product_id: id,
        quantity: Number(qty),
        total_price: total,
      })
      setPlaced(true)
    } catch (err) {
      setOrderError(err?.response?.data?.message ?? err?.message ?? 'Failed to place order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="relative aspect-[16/10] w-full bg-slate-100">
                  {img ? (
                    <img
                      src={img}
                      alt={product?.name || 'Produce'}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-emerald-400 via-lime-300 to-orange-300" />
                  )}
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
                    {product?.category || 'Produce'}
                  </div>
                  <div className="absolute right-4 top-4">
                    <VerificationBadge entity={verifyEntity} size="md" />
                  </div>
                </div>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">{product?.name || 'Product'}</h1>
                  <div className="mt-2 text-sm text-slate-600">
                    Available: {product?.quantity ?? '—'} {product?.unit ?? ''}
                  </div>
                  <div className="mt-4 text-lg font-semibold">GHS {product?.price ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card className="p-6">
                <div className="text-sm font-semibold">Buy now</div>
                {placed ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    Order placed (payment integration comes next).
                  </div>
                ) : (
                  <form onSubmit={placeOrder} className="mt-4 space-y-4">
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        required
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-600">Total</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">GHS {total}</div>
                    </div>

                    {orderError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {orderError}
                      </div>
                    )}

                    <Button className="w-full" disabled={busy}>
                      {busy ? 'Placing…' : 'Place order'}
                    </Button>
                    <Button className="w-full" variant="secondary" disabled title="Coming soon">
                      Subscribe weekly (recurring)
                    </Button>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


