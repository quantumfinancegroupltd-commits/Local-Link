import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'

export function AdminLogin() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = useMemo(() => location.state?.from?.pathname ?? '/admin', [location.state])

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
      if (u?.role !== 'admin') {
        logout()
        setError('This account is not an admin.')
        return
      }
      if (u?.must_change_password) {
        navigate('/admin/set-password', { replace: true })
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Admin login</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to manage LocalLink.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label>Admin email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="name@company.com" />
          </div>
          <div>
            <Label>Password</Label>
            <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Your password" />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <Button disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  )
}


