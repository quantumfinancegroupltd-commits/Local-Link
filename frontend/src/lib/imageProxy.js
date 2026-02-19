/**
 * Use same-origin image proxy so all product images load reliably (avoids referrer/CORS).
 * Backend: GET /api/news/image?src=...
 */
const PROXY_HOSTS = ['images.unsplash.com', 'images.pexels.com', 'upload.wikimedia.org']

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
