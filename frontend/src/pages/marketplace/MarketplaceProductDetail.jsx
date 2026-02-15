import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { VerificationBadge } from '../../components/ui/VerificationBadge.jsx'
import { TrustBadge } from '../../components/ui/TrustBadge.jsx'
import { WhatHappensIfModal } from '../../components/trust/WhatHappensIfModal.jsx'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { useAuth } from '../../auth/useAuth.js'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { StickyActionBar } from '../../components/ui/StickyActionBar.jsx'

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

function etaRangeLabel(minutes) {
  const m = Number(minutes)
  if (!Number.isFinite(m) || m <= 0) return null
  const lo = Math.max(5, Math.round((m * 0.8) / 5) * 5)
  const hi = Math.max(lo + 5, Math.round((m * 1.2) / 5) * 5)
  return `ETA ${lo}–${hi} min`
}

export function MarketplaceProductDetail() {
  const { id } = useParams()
  const { isAuthed, user } = useAuth()
  const canOrder = isAuthed && user?.role === 'buyer'

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [qty, setQty] = useState(1)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryPlaceId, setDeliveryPlaceId] = useState(null)
  const [deliveryLat, setDeliveryLat] = useState(null)
  const [deliveryLng, setDeliveryLng] = useState(null)
  const [feeLoading, setFeeLoading] = useState(false)
  const [feeError, setFeeError] = useState(null)
  const [feeQuote, setFeeQuote] = useState(null)
  const [busy, setBusy] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [placed] = useState(false) // reserved for future "success" UI
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const formRef = useRef(null)

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

  // When coords missing or quote fails, use base fee fallback so buyers can still place orders
  const BASE_DELIVERY_FEE = 10
  const deliveryFee = useMemo(() => {
    const quoted = Number(feeQuote?.fee_ghs ?? 0)
    if (Number.isFinite(quoted) && quoted > 0) return quoted
    return BASE_DELIVERY_FEE
  }, [feeQuote])
  const totalWithDelivery = useMemo(() => {
    const t = Number(total ?? 0)
    const d = Number.isFinite(deliveryFee) ? Number(deliveryFee) : 0
    const sum = t + d
    return Number.isFinite(sum) ? Math.round(sum * 100) / 100 : 0
  }, [deliveryFee, total])

  const pickup = useMemo(() => {
    const lat = product?.farm_lat ?? product?.farmLat ?? product?.farmer?.farm_lat ?? null
    const lng = product?.farm_lng ?? product?.farmLng ?? product?.farmer?.farm_lng ?? null
    const a = lat != null ? Number(lat) : null
    const b = lng != null ? Number(lng) : null
    return a != null && b != null ? { lat: a, lng: b } : null
  }, [product])

  useEffect(() => {
    let cancelled = false
    async function quote() {
      if (!pickup || deliveryLat == null || deliveryLng == null) {
        setFeeQuote(null)
        setFeeError(null)
        return
      }
      setFeeLoading(true)
      setFeeError(null)
      try {
        const res = await http.get('/deliveries/quote', {
          params: {
            pickup_lat: pickup.lat,
            pickup_lng: pickup.lng,
            dropoff_lat: deliveryLat,
            dropoff_lng: deliveryLng,
          },
        })
        if (!cancelled) setFeeQuote(res.data)
      } catch (e) {
        if (!cancelled) setFeeError(e?.response?.data?.message ?? e?.message ?? 'Failed to calculate delivery fee')
      } finally {
        if (!cancelled) setFeeLoading(false)
      }
    }
    quote()
    return () => {
      cancelled = true
    }
  }, [pickup, deliveryLat, deliveryLng])

  const media = useMemo(() => (Array.isArray(product?.media) ? product.media : []), [product])
  const img = useMemo(() => {
    const firstImage = media.find((m) => m?.kind === 'image' && typeof m?.url === 'string' && m.url.trim())
    if (firstImage?.url) return firstImage.url
    return pick(product, ['image_url', 'imageUrl', 'photo_url', 'photoUrl', 'thumbnail_url', 'thumbnailUrl'])
  }, [media, product])
  const verifyEntity =
    product?.farmer ??
    product?.farmer_profile ??
    product?.farmerProfile ??
    product?.farmer_user ??
    product?.farmerUser ??
    product
  const trustScore = product?.farmer?.trust_score ?? product?.farmer_trust_score ?? null

  async function placeOrder(e) {
    e.preventDefault()
    if (!canOrder) return
    setOrderError(null)
    setBusy(true)
    try {
      const res = await http.post('/orders', {
        product_id: id,
        quantity: Number(qty),
        total_price: total,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryFee,
        delivery_place_id: deliveryPlaceId,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        provider: 'paystack',
      })
      const url = res.data?.paystack?.authorization_url
      if (!url) {
        throw new Error('Paystack did not return an authorization URL')
      }
      window.location.assign(url)
    } catch (err) {
      setOrderError(err?.response?.data?.message ?? err?.message ?? 'Failed to place order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <WhatHappensIfModal open={whatIfOpen} onClose={() => setWhatIfOpen(false)} context="produce" />
      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <EmptyState
          title="Product not available"
          description={error}
          actions={
            <Link to="/marketplace">
              <Button variant="secondary">Back to marketplace</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="relative aspect-[16/10] w-full bg-slate-100">
                  {media.length ? (
                    media[0]?.kind === 'video' ? (
                      <video src={media[0]?.url} controls className="h-full w-full object-cover" />
                    ) : (
                      <img
                        src={media[0]?.url || img}
                        alt={product?.name || 'Produce'}
                        className="h-full w-full object-cover"
                        loading="eager"
                      />
                    )
                  ) : img ? (
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
                    <div className="flex flex-col items-end gap-2">
                      <TrustBadge trustScore={trustScore} size="md" />
                      <VerificationBadge entity={verifyEntity} size="md" />
                    </div>
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

              {media.length > 1 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {media.slice(1, 7).map((m) => (
                    <div key={m.url} className="overflow-hidden rounded-2xl border bg-white">
                      {m.kind === 'video' ? (
                        <video src={m.url} controls className="h-48 w-full object-cover" />
                      ) : (
                        <img src={m.url} alt="Produce media" className="h-48 w-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card className="p-6">
                <div className="text-sm font-semibold">Buy now</div>
                {placed ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    Redirecting to Paystack…
                  </div>
                ) : (
                  <form ref={formRef} onSubmit={placeOrder} className="mt-4 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">🔒 Pay with escrow protection</div>
                      <div className="mt-1">
                        If produce quality is bad or delivery fails, you can open a dispute. Support will resolve fairly using evidence.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={() => setWhatIfOpen(true)}>
                          What happens if…?
                        </Button>
                        <Link to="/trust/escrow">
                          <Button type="button" variant="secondary">
                            How escrow works
                          </Button>
                        </Link>
                      </div>
                    </div>
                    {!canOrder ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">Sign in to place an order</div>
                        <div className="mt-1 text-sm text-slate-600">
                          You can browse products without an account, but ordering requires a buyer account.
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link to="/login">
                            <Button variant="secondary">Login</Button>
                          </Link>
                          <Link to="/register?role=buyer&intent=produce">
                            <Button>Create buyer account</Button>
                          </Link>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <Label htmlFor="order_qty">Quantity</Label>
                      <Input
                        id="order_qty"
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        required
                        disabled={busy || !canOrder}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-600">Total</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">GHS {total}</div>
                    </div>
                    <div>
                      <Label htmlFor="order_delivery_address">Delivery address</Label>
                      <LocationInput
                        id="order_delivery_address"
                        value={deliveryAddress}
                        onChange={(v) => {
                          setDeliveryAddress(v)
                          setDeliveryPlaceId(null)
                          setDeliveryLat(null)
                          setDeliveryLng(null)
                        }}
                        onPick={({ placeId, lat, lng }) => {
                          setDeliveryPlaceId(placeId ?? null)
                          setDeliveryLat(typeof lat === 'number' ? lat : null)
                          setDeliveryLng(typeof lng === 'number' ? lng : null)
                        }}
                        disabled={busy || !canOrder}
                      />
                      <div className="mt-2 text-xs text-slate-600">
                        Delivery fee:{' '}
                        <span className="font-semibold">
                          {feeLoading ? 'Calculating…' : `GHS ${Number(deliveryFee ?? 0).toFixed(0)}`}
                        </span>
                        {feeQuote?.distance_km != null ? (
                          <span className="ml-2 text-slate-500">({Number(feeQuote.distance_km).toFixed(1)} km)</span>
                        ) : !pickup ? (
                          <span className="ml-2 text-slate-500">(farm location unknown—estimate)</span>
                        ) : deliveryLat == null || deliveryLng == null ? (
                          <span className="ml-2 text-slate-500">(enter address for exact quote)</span>
                        ) : null}
                        {feeQuote?.eta_minutes != null ? (
                          <span className="ml-2 text-slate-500">{etaRangeLabel(feeQuote.eta_minutes) || ''}</span>
                        ) : null}
                      </div>
                      {feeError ? <div className="mt-2 text-xs text-red-700">{feeError}</div> : null}
                    </div>

                    {orderError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {orderError}
                      </div>
                    )}

                    <Button id="place_order_submit" className="w-full" disabled={busy || !canOrder}>
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

          {canOrder && !placed ? (
            <StickyActionBar
              left={
                <div className="text-xs text-slate-700">
                  Total: <span className="font-semibold">GHS {totalWithDelivery}</span>
                  {feeQuote?.eta_minutes ? <span className="ml-2 text-slate-500">{etaRangeLabel(feeQuote.eta_minutes)}</span> : null}
                </div>
              }
              right={
                <Button
                  disabled={busy || !canOrder}
                  onClick={() => {
                    if (formRef.current?.requestSubmit) return formRef.current.requestSubmit()
                    const btn = document.getElementById('place_order_submit')
                    if (btn) btn.click()
                  }}
                >
                  {busy ? 'Placing…' : 'Place order'}
                </Button>
              }
            />
          ) : null}
        </>
      )}
    </div>
  )
}


