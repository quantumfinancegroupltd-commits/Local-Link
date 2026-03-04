import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const http = axios.create({ baseURL })

/** Origin of the API (e.g. https://locallink.agency or http://localhost:8080). Used so media URLs load from the API server when frontend and API differ (e.g. dev). */
export function getApiOrigin() {
  if (typeof baseURL === 'string' && baseURL.startsWith('http')) {
    try {
      return new URL(baseURL).origin
    } catch {
      /* ignore */
    }
  }
  try {
    return window.location?.origin ?? ''
  } catch {
    return ''
  }
}

/** Resolve a post media URL so images load from the API server (fixes dev when frontend and API are on different origins). */
export function resolveUploadUrl(url) {
  if (!url || typeof url !== 'string') return url
  const s = url.trim()
  if (!s.startsWith('/')) return url
  const origin = getApiOrigin()
  return origin ? `${origin.replace(/\/$/, '')}${s}` : url
}

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('locallink_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('locallink_refresh_token')
  if (!refreshToken) throw new Error('No refresh token')
  const res = await axios.post(`${baseURL}/refresh`, { refreshToken })
  const newToken = res.data?.token
  const newRefresh = res.data?.refreshToken
  if (!newToken) throw new Error('Refresh failed')
  localStorage.setItem('locallink_token', newToken)
  if (newRefresh) localStorage.setItem('locallink_refresh_token', newRefresh)
  return newToken
}

http.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status
    const msg = err?.response?.data?.message
    const reqUrl = String(err?.config?.url || '')
    const pathname = (() => {
      try { return window.location.pathname || '/' } catch { return '/' }
    })()

    if (status === 403 && typeof msg === 'string' && msg.toLowerCase().includes('suspended')) {
      try {
        localStorage.removeItem('locallink_token')
        localStorage.removeItem('locallink_refresh_token')
        localStorage.removeItem('locallink_user')
      } catch { /* ignore */ }
      try {
        const until = err?.response?.data?.suspended_until
        const qs = new URLSearchParams()
        qs.set('reason', 'suspended')
        if (until) qs.set('until', String(until))
        window.location.assign(`/login?${qs.toString()}`)
      } catch { /* ignore */ }
      return Promise.reject(err)
    }

    if (status === 401) {
      const isAuthRequest = reqUrl.includes('/login') || reqUrl.includes('/register') || reqUrl.includes('/refresh')
      const isOnLoginPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/admin/login')

      if (!isAuthRequest && !isOnLoginPage && !err.config._retried) {
        try {
          if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null })
          const newToken = await refreshPromise
          err.config._retried = true
          err.config.headers.Authorization = `Bearer ${newToken}`
          return http(err.config)
        } catch {
          // Refresh failed — fall through to redirect
        }
      }

      if (!isAuthRequest && !isOnLoginPage) {
        try {
          localStorage.removeItem('locallink_token')
          localStorage.removeItem('locallink_refresh_token')
          localStorage.removeItem('locallink_user')
        } catch { /* ignore */ }
        try {
          const next = (() => {
            try { return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}` }
            catch { return '/' }
          })()
          const qs = new URLSearchParams()
          qs.set('reason', 'expired')
          qs.set('next', next)
          if (pathname.startsWith('/admin')) {
            window.location.assign(`/admin/login?${qs.toString()}`)
          } else {
            window.location.assign(`/login?${qs.toString()}`)
          }
        } catch { /* ignore */ }
      }
    }
    return Promise.reject(err)
  },
)
