import { useState } from 'react'
import { Link } from 'react-router-dom'
import { imageProxySrc } from '../../lib/imageProxy.js'
import { VerificationBadge } from '../ui/VerificationBadge.jsx'
import { TrustBadge } from '../ui/TrustBadge.jsx'
import { ui } from '../ui/tokens.js'

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return null
}

function productLocation(p) {
  return (
    pick(p, ['location', 'farm_location', 'farmLocation', 'farmer_location', 'farmerLocation']) || '—'
  )
}

function productImage(p) {
  const media = p?.media
  if (Array.isArray(media) && media.length) {
    const firstImage = media.find((m) => m?.kind === 'image' && typeof m?.url === 'string' && m.url.trim())
    if (firstImage?.url) return firstImage.url
  }
  return pick(p, ['image_url', 'imageUrl', 'photo_url', 'photoUrl', 'thumbnail_url', 'thumbnailUrl'])
}

function farmerFromProduct(product) {
  const f = product?.farmer ?? product?.farmer_profile ?? product?.farmerProfile ?? null
  if (f && (f.id || f.user_id)) return { id: f.id ?? f.user_id, name: f.name ?? 'Seller' }
  const uid = product?.farmer_user_id ?? product?.farmer_user ?? product?.farmerUserId
  if (uid) return { id: uid, name: product?.farmer_name ?? 'Seller' }
  return null
}

export function ProductCard({ product }) {
  const img = productImage(product)
  const loc = productLocation(product)
  const qty = product?.quantity ?? '—'
  const unit = product?.unit ?? ''
  const price = product?.price ?? '—'
  const verifyEntity = product?.farmer ?? product?.farmer_profile ?? product?.farmerProfile ?? product?.farmer_user ?? product?.farmerUser ?? product
  const trustScore = product?.farmer?.trust_score ?? product?.farmer_trust_score ?? null
  const farmer = farmerFromProduct(product)
  const [imgError, setImgError] = useState(false)
  const showImg = img && !imgError

  return (
    <div className={['overflow-hidden', ui.card, ui.cardHover].join(' ')}>
      <Link to={`/marketplace/products/${product.id}`} className="group block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {showImg ? (
            <img
              src={imageProxySrc(img) || img}
              alt={product?.name || 'Produce'}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-400 via-lime-300 to-orange-300 p-4">
              <span className="text-center text-sm font-semibold text-slate-800 drop-shadow-sm">
                {product?.name || 'Produce'}
              </span>
            </div>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
              {product?.category || 'Produce'}
            </div>
            <TrustBadge trustScore={trustScore} />
            <VerificationBadge entity={verifyEntity} />
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {product?.name || 'Produce'}
              </div>
              <div className="mt-1 truncate text-xs text-slate-600">{loc}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">GHS {price}</div>
              <div className="mt-1 text-xs text-slate-600">
                {qty} {unit}
              </div>
            </div>
          </div>
          {product?.meta?.why ? <div className="mt-3 text-xs font-medium text-slate-600">{product.meta.why}</div> : null}
        </div>
      </Link>
      {farmer?.id ? (
        <div className="border-t border-slate-100 px-4 py-2">
          <span className="text-xs text-slate-500">Sold by </span>
          <Link
            to={`/u/${encodeURIComponent(farmer.id)}`}
            className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {farmer.name}
          </Link>
        </div>
      ) : null}
    </div>
  )
}


