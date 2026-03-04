import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { imageProxySrc } from '../../lib/imageProxy.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { VerificationBadge } from '../../components/ui/VerificationBadge.jsx'
import { TrustBadge } from '../../components/ui/TrustBadge.jsx'
import { WhatHappensIfModal } from '../../components/trust/WhatHappensIfModal.jsx'
import { BrowseMap } from '../../components/maps/BrowseMap.jsx'
import { LocationInput } from '../../components/maps/LocationInput.jsx'
import { ui } from '../../components/ui/tokens.js'
import { useAuth } from '../../auth/useAuth.js'
import { useToast } from '../../components/ui/Toast.jsx'
import { useNavigate } from 'react-router-dom'
import { trackEvent } from '../../lib/useAnalytics.js'
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
  const navigate = useNavigate()
  const toast = useToast()
  const canOrder = isAuthed && user?.role === 'buyer'
  const isOwner = isAuthed && user?.role === 'farmer' && product?.farmer?.id === user?.id

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
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('')
  const [occasion, setOccasion] = useState('')
  const [giftMessage, setGiftMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [orderError, setOrderError] = useState(null)
  const [placed] = useState(false) // reserved for future "success" UI
  const [whatIfOpen, setWhatIfOpen] = useState(false)
  const [notifyRestockBusy, setNotifyRestockBusy] = useState(false)
  const [notifyRestockOk, setNotifyRestockOk] = useState(false)
  const [shareToFeedBusy, setShareToFeedBusy] = useState(false)
  const [productReviews, setProductReviews] = useState({ summary: { avg_rating: 0, count: 0 }, reviews: [] })
  const [reviewEligibility, setReviewEligibility] = useState(null)
  const [leaveReviewOpen, setLeaveReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const formRef = useRef(null)

  const outOfStock = useMemo(() => {
    const q = Number(product?.quantity ?? 0)
    return q <= 0 || String(product?.status ?? '') === 'out_of_stock'
  }, [product?.quantity, product?.status])

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

  useEffect(() => {
    if (!id) return
    let cancelled = false
    http.get(`/reviews/products/${id}`)
      .then((res) => {
        if (!cancelled) setProductReviews(res.data ?? { summary: { avg_rating: 0, count: 0 }, reviews: [] })
      })
      .catch(() => {
        if (!cancelled) setProductReviews({ summary: { avg_rating: 0, count: 0 }, reviews: [] })
      })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id || !isAuthed || user?.role !== 'buyer') {
      setReviewEligibility(null)
      return
    }
    let cancelled = false
    http.get(`/reviews/products/${id}/eligibility`)
      .then((res) => {
        if (!cancelled) setReviewEligibility(res.data ?? null)
      })
      .catch(() => {
        if (!cancelled) setReviewEligibility(null)
      })
    return () => { cancelled = true }
  }, [id, isAuthed, user?.role])

  const isFloristProduct = useMemo(() => {
    const cat = String(product?.category ?? '').toLowerCase()
    return cat === 'flowers' || cat === 'plants'
  }, [product?.category])

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
        requested_delivery_date: requestedDeliveryDate.trim() || null,
        occasion: occasion.trim() || null,
        gift_message: giftMessage.trim() || null,
        provider: 'paystack',
      })
      trackEvent('order_placed')
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
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="relative aspect-[16/10] w-full bg-slate-100 dark:bg-slate-800">
                  {media.length ? (
                    media[0]?.kind === 'video' ? (
                      <video src={media[0]?.url} controls className="h-full w-full object-cover" />
                    ) : (
                      <img
                        src={imageProxySrc(media[0]?.url || img) || media[0]?.url || img}
                        alt={product?.name || 'Produce'}
                        className="h-full w-full object-cover"
                        loading="eager"
                      />
                    )
                  ) : img ? (
                    <img
                      src={imageProxySrc(img) || img}
                      alt={product?.name || 'Produce'}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-emerald-400 via-lime-300 to-orange-300" />
                  )}
                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur dark:bg-white/20 dark:text-white">
                    {product?.category || 'Produce'}
                  </div>
                  <div className="absolute right-4 top-4">
                    <div className="flex flex-col items-end gap-2">
                      <TrustBadge trustScore={trustScore} size="md" />
                      <VerificationBadge entity={verifyEntity} size="md" />
                    </div>
                  </div>
                </div>
                <div className="p-6 dark:text-slate-100">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h1 className={`${ui.h1} dark:text-white`}>{product?.name || 'Product'}</h1>
                    {isOwner && id ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={shareToFeedBusy}
                        onClick={async () => {
                          setShareToFeedBusy(true)
                          try {
                            await http.post('/posts', {
                              body: '',
                              type: 'produce',
                              related_type: 'product',
                              related_id: id,
                            })
                            toast.success('Shared to feed')
                            navigate('/feed')
                          } catch (e) {
                            toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to share')
                          } finally {
                            setShareToFeedBusy(false)
                          }
                        }}
                      >
                        {shareToFeedBusy ? 'Sharing…' : 'Share to feed'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {outOfStock ? (
                      <span className="font-semibold text-amber-700 dark:text-amber-400">Out of stock</span>
                    ) : (
                      <>Available: {product?.quantity ?? '—'} {product?.unit ?? ''}</>
                    )}
                  </div>
                  {product?.recipe ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-white">Contents:</span>{' '}
                      <span className="whitespace-pre-wrap">{product.recipe}</span>
                    </div>
                  ) : null}
                  <div className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">GHS {product?.price ?? '—'}</div>
                </div>
              </div>

              {media.length > 1 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {media.slice(1, 7).map((m) => (
                    <div key={m.url} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/5">
                      {m.kind === 'video' ? (
                        <video src={m.url} controls className="h-48 w-full object-cover" />
                      ) : (
                        <img src={imageProxySrc(m.url) || m.url} alt="Produce media" className="h-48 w-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {pickup ? (
                <Card className="mt-6 p-4">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Map</h2>
                  <div className="mt-3 h-56 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <BrowseMap
                      pins={[
                        {
                          id: 'farm',
                          lat: pickup.lat,
                          lng: pickup.lng,
                          title: product?.name || 'Produce',
                          subtitle: product?.farmer?.name || product?.farm_location || undefined,
                        },
                      ]}
                      defaultCenter={pickup}
                      defaultZoom={12}
                      className="h-full w-full"
                    />
                  </div>
                </Card>
              ) : null}

              <Card className="mt-6 p-4">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Reviews</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">
                    {(product?.review_summary?.avg_rating ?? productReviews?.summary?.avg_rating ?? 0).toFixed(1)}
                  </span>
                  <span className="flex items-center gap-0.5 text-amber-500" aria-hidden>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star}>
                        {star <= (product?.review_summary?.avg_rating ?? productReviews?.summary?.avg_rating ?? 0)
                          ? '★'
                          : '☆'}
                      </span>
                    ))}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {(product?.review_summary?.review_count ?? productReviews?.summary?.count ?? 0)} review
                    {(product?.review_summary?.review_count ?? productReviews?.summary?.count ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {reviewEligibility?.eligible && !leaveReviewOpen && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => setLeaveReviewOpen(true)}>
                      Leave a review
                    </Button>
                  )}
                </div>
                {leaveReviewOpen && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white">Your review</div>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="text-2xl text-amber-500 hover:opacity-80"
                          onClick={() => setReviewRating(star)}
                          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                        >
                          {star <= reviewRating ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Label>Comment (optional)</Label>
                      <Textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="How was the product?"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        disabled={reviewSubmitting}
                        onClick={async () => {
                          setReviewSubmitting(true)
                          try {
                            await http.post(`/reviews/products/${id}`, {
                              rating: reviewRating,
                              comment: reviewComment.trim() || undefined,
                              order_id: reviewEligibility?.order_id ?? undefined,
                            })
                            toast.success('Review added')
                            setLeaveReviewOpen(false)
                            setReviewRating(5)
                            setReviewComment('')
                            const res = await http.get(`/reviews/products/${id}`)
                            setProductReviews(res.data ?? { summary: { avg_rating: 0, count: 0 }, reviews: [] })
                            setReviewEligibility({ ...reviewEligibility, eligible: false, already_reviewed: true })
                            if (product) setProduct({ ...product, review_summary: res.data?.summary })
                          } catch (e) {
                            toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to submit review')
                          } finally {
                            setReviewSubmitting(false)
                          }
                        }}
                      >
                        {reviewSubmitting ? 'Submitting…' : 'Submit review'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={reviewSubmitting}
                        onClick={() => { setLeaveReviewOpen(false); setReviewRating(5); setReviewComment('') }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {!reviewEligibility?.eligible && reviewEligibility?.reason && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{reviewEligibility.reason}</p>
                )}
                <div className="mt-4 space-y-3">
                  {(productReviews?.reviews ?? []).length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No reviews yet. Be the first to review after you receive this product.</p>
                  ) : (
                    (productReviews?.reviews ?? []).map((r) => (
                      <div
                        key={r.id}
                        className="rounded-lg border border-slate-200 py-2 px-3 dark:border-white/10 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-amber-500">{'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}</span>
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.reviewer_name ?? 'Buyer'}</span>
                          {r.verified_purchase && (
                            <span className="text-[10px] rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5">Verified purchase</span>
                          )}
                        </div>
                        {r.comment ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{r.comment}</p> : null}
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <Card className="p-6">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Buy now</div>
                {placed ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    Redirecting to Paystack…
                  </div>
                ) : (
                  <form ref={formRef} onSubmit={placeOrder} className="mt-4 space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      <div className="font-semibold text-slate-900 dark:text-white">🔒 Pay with escrow protection</div>
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
                    {outOfStock && canOrder ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">
                        <div className="font-semibold">Out of stock</div>
                        <div className="mt-1">We&apos;ll notify you when this product is back in stock.</div>
                        {notifyRestockOk ? (
                          <div className="mt-3 font-medium text-emerald-700 dark:text-emerald-400">You&apos;re on the list. We&apos;ll notify you.</div>
                        ) : (
                          <Button
                            type="button"
                            className="mt-3"
                            disabled={notifyRestockBusy}
                            onClick={async () => {
                              setNotifyRestockBusy(true)
                              try {
                                await http.post(`/products/${id}/notify-restock`)
                                setNotifyRestockOk(true)
                              } catch {
                                setNotifyRestockBusy(false)
                              }
                            }}
                          >
                            {notifyRestockBusy ? 'Adding…' : 'Notify me when back in stock'}
                          </Button>
                        )}
                      </div>
                    ) : null}
                    {!canOrder ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-white">Sign in to place an order</div>
                        <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
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
                    {isFloristProduct ? (
                      <>
                        <div>
                          <Label htmlFor="order_delivery_date">Delivery date (optional)</Label>
                          <Input
                            id="order_delivery_date"
                            type="date"
                            value={requestedDeliveryDate}
                            onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                            disabled={busy || !canOrder}
                          />
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            When you need this delivered (e.g. for a specific occasion).
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="order_occasion">Occasion (optional)</Label>
                          <Select
                            id="order_occasion"
                            value={occasion}
                            onChange={(e) => setOccasion(e.target.value)}
                            disabled={busy || !canOrder}
                          >
                            <option value="">None</option>
                            <option value="Birthday">Birthday</option>
                            <option value="Valentine's">Valentine's</option>
                            <option value="Mother's Day">Mother's Day</option>
                            <option value="Sympathy">Sympathy</option>
                            <option value="Get well">Get well</option>
                            <option value="Thank you">Thank you</option>
                            <option value="Anniversary">Anniversary</option>
                            <option value="Just because">Just because</option>
                            <option value="Other">Other</option>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="order_gift_message">Gift / card message (optional)</Label>
                          <Textarea
                            id="order_gift_message"
                            value={giftMessage}
                            onChange={(e) => setGiftMessage(e.target.value)}
                            placeholder="e.g. Happy birthday! Love from us"
                            rows={2}
                            disabled={busy || !canOrder}
                          />
                        </div>
                      </>
                    ) : null}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="text-xs text-slate-600 dark:text-slate-400">Total</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">GHS {total}</div>
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
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
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
                      {feeError ? <div className="mt-2 text-xs text-red-700 dark:text-red-400">{feeError}</div> : null}
                    </div>

                    {orderError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300">
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
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  Total: <span className="font-semibold">GHS {totalWithDelivery}</span>
                  {feeQuote?.eta_minutes ? <span className="ml-2 text-slate-500 dark:text-slate-400">{etaRangeLabel(feeQuote.eta_minutes)}</span> : null}
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


