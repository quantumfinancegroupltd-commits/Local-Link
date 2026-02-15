import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const http = axios.create({
  baseURL,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('locallink_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status
    const msg = err?.response?.data?.message
    const reqUrl = String(err?.config?.url || '')
    const pathname = (() => {
      try {
        return window.location.pathname || '/'
      } catch {
        return '/'
      }
    })()
    if (status === 403 && typeof msg === 'string' && msg.toLowerCase().includes('suspended')) {
      // Clear stale session so the app doesn't appear "half-working".
      try {
        localStorage.removeItem('locallink_token')
        localStorage.removeItem('locallink_user')
      } catch {
        // ignore
      }
      try {
        const until = err?.response?.data?.suspended_until
        const qs = new URLSearchParams()
        qs.set('reason', 'suspended')
        if (until) qs.set('until', String(until))
        window.location.assign(`/login?${qs.toString()}`)
      } catch {
        // ignore
      }
    }
    if (status === 401) {
      // Avoid hijacking auth flows (wrong password should show inline error on login pages).
      const isAuthRequest = reqUrl.includes('/login') || reqUrl.includes('/register')
      const isOnLoginPage = pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/admin/login')
      if (!isAuthRequest && !isOnLoginPage) {
        try {
          localStorage.removeItem('locallink_token')
          localStorage.removeItem('locallink_user')
        } catch {
          // ignore
        }
        try {
          const next = (() => {
            try {
              return `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`
            } catch {
              return '/'
            }
          })()
          const qs = new URLSearchParams()
          qs.set('reason', 'expired')
          qs.set('next', next)
          if (pathname.startsWith('/admin')) {
            window.location.assign(`/admin/login?${qs.toString()}`)
          } else {
            window.location.assign(`/login?${qs.toString()}`)
          }
        } catch {
          // ignore
        }
      }
    }
    return Promise.reject(err)
  },
)


