import { useEffect } from 'react'

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    document.head.appendChild(el)
  }
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null) el.removeAttribute(k)
    else el.setAttribute(k, String(v))
  })
  return el
}

export function usePageMeta({ title, description, image, url, type = 'website' }) {
  useEffect(() => {
    if (title) document.title = title

    if (description) upsertMeta('meta[name="description"]', { name: 'description', content: description })

    // OpenGraph
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type })
    if (title) upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
    if (description) upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
    if (image) upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
    if (url) upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url })

    // Twitter (best-effort)
    if (title) upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
    if (description) upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
    if (image) upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  }, [title, description, image, url, type])
}


