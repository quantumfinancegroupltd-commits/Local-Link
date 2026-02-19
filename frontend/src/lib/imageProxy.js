/**
 * Use same-origin image proxy for CDNs that block referrers (Unsplash, Pexels).
 * Wikimedia allows hotlinking — load directly with no-referrer to avoid proxy failures.
 */
const PROXY_HOSTS = ['images.unsplash.com', 'images.pexels.com']

export function imageProxySrc(url) {
  if (!url || typeof url !== 'string') return url
  try {
    const u = new URL(url)
    if (PROXY_HOSTS.includes(u.hostname)) {
      return `/api/news/image?src=${encodeURIComponent(url)}`
    }
  } catch {
    // ignore
  }
  return url
}
