import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { roleHomePath } from '../../lib/roles.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = useMemo(() => location.state?.from?.pathname ?? null, [location.state])

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
      navigate(from || roleHomePath(u?.role), { replace: true })
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
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
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


