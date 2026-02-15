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


