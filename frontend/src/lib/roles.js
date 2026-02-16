export function roleHomePath(role) {
  switch (role) {
    case 'buyer':
      return '/buyer'
    case 'artisan':
      return '/artisan'
    case 'farmer':
      return '/farmer'
    case 'driver':
      return '/driver'
    case 'company':
      return '/company'
    case 'admin':
      return '/admin'
    default:
      return '/'
  }
}

/** Display label for a role (badges, filters, profile type). */
export function getRoleLabel(role) {
  const r = String(role || '').toLowerCase()
  if (r === 'buyer') return 'Buyer'
  if (r === 'artisan') return 'Provider'
  if (r === 'farmer') return 'Farmer / Florist'
  if (r === 'driver') return 'Driver'
  if (r === 'company') return 'Company'
  if (r === 'admin') return 'Admin'
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : ''
}

/** Kicker/title label when context is farmer vs florist (same account, different vertical). */
export function getFarmerVerticalLabel(vertical) {
  return vertical === 'florist' ? 'Florist' : 'Produce (Farmer)'
}

/** Plural/marketing label for farmer+florist (e.g. "Farmers & Florists Marketplace"). */
export const FARMER_FLORIST_MARKETPLACE_LABEL = 'Farmers & Florists'

export const FARMER_VERTICAL_KEY = 'locallink_farmer_vertical'

export function getStoredFarmerVertical() {
  try {
    const v = localStorage.getItem(FARMER_VERTICAL_KEY)
    return v === 'florist' ? 'florist' : 'farmer'
  } catch {
    return 'farmer'
  }
}


