import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'

export function AdminSetPassword() {
  const { token, user, setSession, logout } = useAuth()
  const navigate = useNavigate()

  const mustChange = Boolean(user?.must_change_password)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = useMemo(() => {
    if (!newPassword || newPassword.length < 8) return false
    if (newPassword !== confirmPassword) return false
    return true
  }, [newPassword, confirmPassword])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    setBusy(true)
    try {
      const res = await http.post('/me/password', { new_password: newPassword })
      const nextUser = res.data?.user ?? null
      if (!nextUser) throw new Error('Password update failed')
      setSession(token, nextUser)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Could not update password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Set a new admin password</h1>
        <p className="mt-1 text-sm text-slate-600">For security, you must change the default password.</p>

        {!mustChange && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Your password is already set.{' '}
            <button className="font-semibold text-emerald-700 hover:underline" onClick={() => navigate('/admin')}>
              Go to admin
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label>New password</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" minLength={8} required />
            <div className="mt-1 text-xs text-slate-500">At least 8 characters.</div>
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" minLength={8} required />
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-2">
            <Button disabled={busy || !canSubmit} className="flex-1">
              {busy ? 'Saving…' : 'Save password'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                logout()
                navigate('/admin/login', { replace: true })
              }}
            >
              Sign out
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


