import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { roleHomePath } from '../../lib/roles.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('buyer')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const r = params.get('role')
    if (r === 'buyer' || r === 'artisan' || r === 'farmer') setRole(r)
  }, [params])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const u = await register({ name, email, phone, password, role })
      navigate(roleHomePath(u?.role || role), { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">Choose your role to get started.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="buyer">Buyer / Homeowner</option>
              <option value="artisan">Artisan / Skilled labor</option>
              <option value="farmer">Farmer</option>
            </Select>
          </div>

          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233…" />
            </div>
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
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
            Login
          </Link>
        </div>
      </Card>
    </div>
  )
}


