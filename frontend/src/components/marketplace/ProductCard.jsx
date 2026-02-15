import { Link } from 'react-router-dom'
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

export function ProductCard({ product }) {
  const img = productImage(product)
  const loc = productLocation(product)
  const qty = product?.quantity ?? '—'
  const unit = product?.unit ?? ''
  const price = product?.price ?? '—'
  const verifyEntity = product?.farmer ?? product?.farmer_profile ?? product?.farmerProfile ?? product?.farmer_user ?? product?.farmerUser ?? product
  const trustScore = product?.farmer?.trust_score ?? product?.farmer_trust_score ?? null

  return (
    <Link to={`/marketplace/products/${product.id}`} className="group">
      <div className={['overflow-hidden', ui.card, ui.cardHover].join(' ')}>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {img ? (
            <img
              src={img}
              alt={product?.name || 'Produce'}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-emerald-400 via-lime-300 to-orange-300" />
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
      </div>
    </Link>
  )
}


