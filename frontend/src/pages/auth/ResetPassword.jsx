import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

function useQueryToken() {
  const location = useLocation()
  return useMemo(() => {
    try {
      const qs = new URLSearchParams(location.search || '')
      const t = qs.get('token')
      return t ? String(t) : ''
    } catch {
      return ''
    }
  }, [location.search])
}

export function ResetPassword() {
  const toast = useToast()
  const navigate = useNavigate()
  const tokenFromQuery = useQueryToken()

  const [token, setToken] = useState(tokenFromQuery)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (!token || token.length < 20) {
      setError('Missing or invalid reset token.')
      return
    }
    if (pw1.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (pw1 !== pw2) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await http.post('/password/reset', { token, new_password: pw1 })
      setDone(true)
      toast.success('Password updated. Please log in.')
      setTimeout(() => navigate('/login', { replace: true }), 600)
    } catch (e2) {
      const msg = e2?.response?.data?.message ?? e2?.message ?? 'Failed to reset password'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Reset password</h1>
        <p className="mt-1 text-sm text-slate-600">Choose a new password for your account.</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {!tokenFromQuery ? (
            <div>
              <Label>Reset token</Label>
              <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token from email" disabled={busy || done} />
              <div className="mt-1 text-xs text-slate-500">Tip: open the reset link from your email instead of pasting.</div>
            </div>
          ) : null}

          <div>
            <Label>New password</Label>
            <Input value={pw1} onChange={(e) => setPw1(e.target.value)} type="password" disabled={busy || done} required />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input value={pw2} onChange={(e) => setPw2(e.target.value)} type="password" disabled={busy || done} required />
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {done ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Password updated. Redirecting…</div>
          ) : null}

          <Button disabled={busy || done} className="w-full">
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>

        <div className="mt-4 text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
            Back to login
          </Link>
        </div>
      </Card>
    </div>
  )
}

