import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { getRoleLabel, roleHomePath } from '../../lib/roles.js'
import { trackEvent } from '../../lib/useAnalytics.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { openAssistant } from '../../components/assistant/AssistantFab.jsx'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('buyer')
  const [referralCode, setReferralCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const r = params.get('role')
    if (r === 'buyer' || r === 'artisan' || r === 'farmer' || r === 'driver' || r === 'company') setRole(r)
    const ref = params.get('ref') || params.get('referral')
    if (ref) setReferralCode(String(ref).trim())
  }, [params])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const u = await register({ name, email, phone, password, role, referral_code: referralCode.trim() || undefined })
      trackEvent('signup')
      const finalRole = u?.role || role
      const intent = String(params.get('intent') ?? '').toLowerCase()
      const category = params.get('category')

      // Recommended “two door” buyer experience:
      // - fix → start at post job
      // - produce → go straight to marketplace
      if (finalRole === 'buyer') {
        if (intent === 'produce') return navigate('/marketplace', { replace: true })
        if (intent === 'fix') {
          const qs = category ? `?category=${encodeURIComponent(category)}` : ''
          return navigate(`/buyer/jobs/new${qs}`, { replace: true })
        }
      }

      navigate(roleHomePath(finalRole), { replace: true })
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
            <Label htmlFor="reg-role">I am a</Label>
            <Select id="reg-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="buyer">Buyer — hire pros, buy produce, post jobs</option>
              <option value="artisan">Artisan — offer skills (events, catering, cleaning, repairs…)</option>
              <option value="farmer">{getRoleLabel('farmer')} — sell produce, flowers & plants</option>
              <option value="driver">Driver — delivery partner</option>
              <option value="company">Company — hire staff, manage shifts</option>
            </Select>
            <p className="mt-1.5 text-xs text-slate-500">Buyers post jobs and use escrow; artisans, farmers and drivers get hired and earn.</p>
            <p className="mt-2">
              <button type="button" onClick={openAssistant} className="text-xs font-semibold text-emerald-700 hover:underline">
                Not sure which role to pick? Ask YAO
              </button>
            </p>
          </div>

          <div>
            <Label htmlFor="reg-name">Full name</Label>
            <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reg-email">Email</Label>
              <Input
                id="reg-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-phone">Phone</Label>
              <Input
                id="reg-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233…"
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reg-password">Password</Label>
            <Input
              id="reg-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <Label htmlFor="reg-referral">Referral code (optional)</Label>
            <Input
              id="reg-referral"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="If a friend shared their code"
              autoComplete="off"
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


