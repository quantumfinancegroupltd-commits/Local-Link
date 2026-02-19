import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { roleHomePath } from '../../lib/roles.js'
import { trackEvent } from '../../lib/useAnalytics.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = useMemo(() => {
    const f = location.state?.from
    if (!f) return null
    const p = typeof f.pathname === 'string' ? f.pathname : ''
    const s = typeof f.search === 'string' ? f.search : ''
    const h = typeof f.hash === 'string' ? f.hash : ''
    const full = `${p}${s}${h}`
    return full || null
  }, [location.state])
  const suspendedInfo = useMemo(() => {
    try {
      const url = new URL(window.location.href)
      const reason = url.searchParams.get('reason')
      const until = url.searchParams.get('until')
      if (reason !== 'suspended') return null
      return { until }
    } catch {
      return null
    }
  }, [])
  const expiredInfo = useMemo(() => {
    try {
      const url = new URL(window.location.href)
      const reason = url.searchParams.get('reason')
      const next = url.searchParams.get('next')
      if (reason !== 'expired') return null
      return { next }
    } catch {
      return null
    }
  }, [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const u = await login({ email, password })
      trackEvent('login')
      if (u?.role === 'admin' && u?.must_change_password) {
        navigate('/admin/set-password', { replace: true })
      } else {
        // Prefer react-router "from", otherwise honor next= from an auth redirect, otherwise role home.
        const next = expiredInfo?.next && typeof expiredInfo.next === 'string' ? expiredInfo.next : null
        navigate(from || next || roleHomePath(u?.role), { replace: true })
      }
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Login</h1>
        <p className="mt-1 text-sm text-slate-600">Welcome back.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {suspendedInfo ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-semibold">Account temporarily suspended</div>
              <div className="mt-1">
                Please contact support if you believe this is a mistake.
                {suspendedInfo.until ? (
                  <span className="ml-1">Suspended until: {new Date(suspendedInfo.until).toLocaleString()}.</span>
                ) : null}
              </div>
              <div className="mt-2">
                <Link className="font-semibold underline" to="/support">
                  Open Support
                </Link>
              </div>
            </div>
          ) : null}
          {expiredInfo ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-semibold">Session expired</div>
              <div className="mt-1">Please sign in again to continue. Any unsaved changes (e.g. profile photo, service edits) were not saved — you’ll need to make them again after logging in.</div>
            </div>
          ) : null}
          <div>
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
            <div className="mt-2 text-xs">
              <Link to="/forgot-password" className="font-semibold text-emerald-700 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <Button disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          No account?{' '}
          <Link to="/register" className="font-semibold text-emerald-700 hover:underline">
            Register
          </Link>
        </div>
      </Card>
    </div>
  )
}


