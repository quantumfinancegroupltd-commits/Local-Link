import { useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

export function ForgotPassword() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [devUrl, setDevUrl] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setDevUrl(null)
    try {
      const r = await http.post('/password/forgot', { email })
      const url = r?.data?.dev_reset_url ?? null
      setDevUrl(url)
      setSent(true)
      toast.success('If that email exists, a reset link has been sent.')
    } catch (e2) {
      const msg = e2?.response?.data?.message ?? e2?.message ?? 'Failed to request reset'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-600">We’ll email you a secure link to reset your password.</p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required disabled={busy || sent} />
          </div>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

          {sent ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <div className="font-semibold">Check your email</div>
              <div className="mt-1">
                If the address is registered, you’ll receive a reset link shortly. (It may take a minute and may land in spam.)
              </div>
              {devUrl ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Dev shortcut</div>
                  <a className="mt-1 block break-all underline" href={devUrl}>
                    {devUrl}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}

          <Button disabled={busy || sent} className="w-full">
            {busy ? 'Sending…' : sent ? 'Email sent' : 'Send reset link'}
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

