const ORDERED_TIERS = ['unverified', 'bronze', 'silver', 'gold']

export function normalizeTier(tier) {
  const t = String(tier ?? '').toLowerCase().trim()
  if (t === 'gold') return 'gold'
  if (t === 'silver') return 'silver'
  if (t === 'bronze') return 'bronze'
  if (t === 'verified') return 'bronze'
  return 'unverified'
}

export function tierLabel(tier) {
  switch (tier) {
    case 'gold':
      return 'Gold'
    case 'silver':
      return 'Silver'
    case 'bronze':
      return 'Bronze'
    default:
      return 'Unverified'
  }
}

export function tierRank(tier) {
  const idx = ORDERED_TIERS.indexOf(normalizeTier(tier))
  return idx === -1 ? 0 : idx
}

/**
 * Infer verification tier from common API shapes.
 * Supports explicit tier fields, otherwise falls back to heuristics:
 * - verified true => Bronze
 * - docs / references / proof => Silver
 * - partner/on-site flags => Gold
 */
export function getVerificationTier(entity) {
  if (!entity || typeof entity !== 'object') return 'unverified'

  const explicit =
    entity.verification_tier ??
    entity.verificationTier ??
    entity.verification_level ??
    entity.verificationLevel ??
    entity.verified_level ??
    entity.verifiedLevel ??
    null

  if (explicit) return normalizeTier(explicit)

  const goldFlag =
    entity.on_site_verified ??
    entity.onSiteVerified ??
    entity.partner_verified ??
    entity.partnerVerified ??
    entity.gold_verified ??
    entity.goldVerified ??
    false

  if (goldFlag) return 'gold'

  const verified = Boolean(entity.verified ?? entity.isVerified ?? entity.is_verified)
  const docs =
    entity.verified_docs ??
    entity.verifiedDocs ??
    entity.verification_docs ??
    entity.verificationDocs ??
    entity.docs ??
    null

  // If docs exist (array/object) treat as at least Silver when already verified.
  const hasDocs =
    Array.isArray(docs) ? docs.length > 0 : docs && typeof docs === 'object' ? Object.keys(docs).length > 0 : false

  // If there are reference-like fields, treat as Silver.
  const hasRefs = Boolean(
    entity.references ??
      entity.referees ??
      entity.reference_count ??
      entity.referenceCount ??
      (docs && (docs.references || docs.referees || docs.harvest_proof || docs.harvestProof)),
  )

  if (verified && (hasDocs || hasRefs)) return 'silver'
  if (verified) return 'bronze'

  return 'unverified'
}


