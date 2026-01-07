import { getVerificationTier, tierLabel } from '../../lib/verification.js'

const STYLES = {
  unverified: 'border-slate-200 bg-slate-50 text-slate-700',
  bronze: 'border-orange-200 bg-orange-50 text-orange-800',
  silver: 'border-slate-200 bg-slate-100 text-slate-800',
  gold: 'border-yellow-200 bg-yellow-50 text-yellow-900',
}

export function VerificationBadge({ entity, tier: tierProp, size = 'sm' }) {
  const tier = tierProp ?? getVerificationTier(entity)
  const label = tierLabel(tier)
  const s = STYLES[tier] ?? STYLES.unverified
  const sz = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${sz} font-semibold ${s}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      Verified: {label}
    </span>
  )
}


