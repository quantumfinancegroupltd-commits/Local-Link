export function haversineKm(lat1, lng1, lat2, lng2) {
  const a = Number(lat1)
  const b = Number(lng1)
  const c = Number(lat2)
  const d = Number(lng2)
  if (![a, b, c, d].every((x) => Number.isFinite(x))) return null

  const R = 6371 // km
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(c - a)
  const dLng = toRad(d - b)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)

  const aa = s1 * s1 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * s2 * s2
  const cc = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return R * cc
}

export function formatKm(km) {
  if (km == null) return null
  const n = Number(km)
  if (!Number.isFinite(n)) return null
  if (n < 1) return `${Math.max(0.1, Math.round(n * 10) / 10).toFixed(1)} km`
  if (n < 10) return `${n.toFixed(1)} km`
  return `${Math.round(n)} km`
}

/** Approximate lat/lng for common Ghana location strings (fallback when API has no coords). */
const GHANA_LOCATION_FALLBACKS = [
  { keys: ['accra'], lat: 5.6037, lng: -0.187 },
  { keys: ['tema'], lat: 5.6698, lng: -0.0167 },
  { keys: ['kumasi'], lat: 6.6884, lng: -1.6244 },
  { keys: ['east legon', 'legon'], lat: 5.61, lng: -0.19 },
  { keys: ['spintex'], lat: 5.58, lng: -0.21 },
  { keys: ['tamale'], lat: 9.4039, lng: -0.843 },
  { keys: ['takoradi', 'sekondi'], lat: 4.8845, lng: -1.7554 },
  { keys: ['cape coast'], lat: 5.1053, lng: -1.2466 },
  { keys: ['koforidua', 'eastern region'], lat: 6.0941, lng: -0.2592 },
  { keys: ['osu', 'cantonments'], lat: 5.55, lng: -0.2 },
]

/**
 * Resolve location text to approximate coords. Uses the LAST matching place in the text
 * so e.g. "Accra, Tema" or "Warehouse (Tema)" maps to Tema, not Accra.
 * Longer keys (e.g. "east legon") are checked before shorter ones ("legon") so we prefer the specific place.
 */
export function coordsFromLocationText(text) {
  if (!text || typeof text !== 'string') return null
  const normalized = text.trim().toLowerCase()
  if (!normalized) return null
  let best = null
  let bestEnd = -1
  for (const { keys, lat, lng } of GHANA_LOCATION_FALLBACKS) {
    for (const k of keys) {
      const idx = normalized.indexOf(k)
      if (idx === -1) continue
      const end = idx + k.length
      if (end > bestEnd) {
        bestEnd = end
        best = { lat, lng }
      }
    }
  }
  return best
}

/** Round coords to a key for grouping (so nearby pins are treated as same location). */
function coordKey(lat, lng, decimals = 3) {
  return `${Number(lat).toFixed(decimals)}_${Number(lng).toFixed(decimals)}`
}

/**
 * Spread pins that share the same (or very close) lat/lng so they don't stack on the map.
 * Each duplicate gets a small offset in a circle so all remain visible.
 * @param {Array<{ lat: number, lng: number, [k: string]: unknown }>} pins
 * @param {number} radiusDeg - offset radius in degrees (~0.002 = ~200m)
 * @returns pins with adjusted lat/lng
 */
export function spreadDuplicatePins(pins, radiusDeg = 0.002) {
  if (!Array.isArray(pins) || pins.length === 0) return pins
  const byKey = new Map()
  for (const p of pins) {
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const key = coordKey(lat, lng)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push({ ...p, lat, lng })
  }
  const out = []
  for (const group of byKey.values()) {
    if (group.length <= 1) {
      out.push(...group)
      continue
    }
    group.forEach((pin, i) => {
      const angle = (2 * Math.PI * i) / group.length
      out.push({
        ...pin,
        lat: pin.lat + radiusDeg * Math.cos(angle),
        lng: pin.lng + radiusDeg * Math.sin(angle),
      })
    })
  }
  return out
}

/**
 * Spread duplicate pins in a small grid (2 columns) so they're all visible without a circular pattern.
 * @param {Array<{ lat: number, lng: number, [k: string]: unknown }>} pins
 * @param {number} stepDeg - step between pins in degrees (~0.0015 = ~150m)
 * @returns pins with adjusted lat/lng
 */
export function spreadDuplicatePinsGrid(pins, stepDeg = 0.0015) {
  if (!Array.isArray(pins) || pins.length === 0) return pins
  const byKey = new Map()
  for (const p of pins) {
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const key = coordKey(lat, lng)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push({ ...p, lat, lng })
  }
  const out = []
  const cols = 2
  for (const group of byKey.values()) {
    if (group.length <= 1) {
      out.push(...group)
      continue
    }
    group.forEach((pin, i) => {
      const row = Math.floor(i / cols)
      const col = i % cols
      out.push({
        ...pin,
        lat: pin.lat + row * stepDeg,
        lng: pin.lng + col * stepDeg,
      })
    })
  }
  return out
}


