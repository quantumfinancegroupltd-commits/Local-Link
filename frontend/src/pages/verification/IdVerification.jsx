import { useEffect, useMemo, useState } from 'react'
import { http } from '../../api/http.js'
import { uploadPrivateMediaFiles } from '../../api/uploads.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

function statusLabel(s) {
  if (s === 'pending') return 'Pending review'
  if (s === 'approved') return 'Approved'
  if (s === 'needs_correction') return 'Needs correction'
  if (s === 'rejected') return 'Rejected'
  return 'Not submitted'
}

export function IdVerification() {
  const { user } = useAuth()
  const toast = useToast()

  const canVerify = useMemo(() => ['artisan', 'farmer', 'driver'].includes(user?.role), [user?.role])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null) // { id_verified, latest_request }
  const [error, setError] = useState(null)

  const [busy, setBusy] = useState(false)
  const [idFront, setIdFront] = useState(null)
  const [idBack, setIdBack] = useState(null)
  const [selfie, setSelfie] = useState(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await http.get('/id-verification/status')
      setStatus(res.data ?? null)
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load verification status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      if (!canVerify) throw new Error('Only providers can verify')
      if (!idFront) throw new Error('Please upload a clear Ghana Card front image')
      if (!selfie) throw new Error('Please upload a selfie')

      const files = [idFront, idBack, selfie].filter(Boolean)
      const uploaded = await uploadPrivateMediaFiles(files, { purpose: 'id_verification' })

      const front = uploaded[0]
      const back = idBack ? uploaded[1] : null
      const sf = idBack ? uploaded[2] : uploaded[1]

      await http.post('/id-verification/submit', {
        id_type: 'ghana_card',
        id_front_url: front?.url,
        id_back_url: back?.url ?? null,
        selfie_url: sf?.url,
      })

      toast.success('Submitted for review. Usually within 24 hours.')
      setIdFront(null)
      setIdBack(null)
      setSelfie(null)
      await refresh()
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to submit verification'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const latest = status?.latest_request ?? null
  const idVerified = Boolean(status?.id_verified)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Verify your account"
        subtitle="Providers verify with Ghana Card to accept paid work and receive payouts."
      />

      {!canVerify ? (
        <Card className="p-5">
          <div className="text-sm text-slate-700">ID verification is currently required only for providers (artisan, farmer, driver).</div>
        </Card>
      ) : null}

      <Card className="p-5">
        {loading ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-semibold">Status:</span>{' '}
              <span className="text-slate-700">{idVerified ? 'Verified' : statusLabel(latest?.status)}</span>
            </div>
            {latest?.status === 'needs_correction' || latest?.status === 'rejected' ? (
              <div className="text-sm text-slate-700">
                <span className="font-semibold">Reason:</span> {latest?.rejection_reason ?? '—'}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {canVerify && !idVerified ? (
        <Card className="p-5">
          <div className="text-sm font-semibold">Submit Ghana Card verification</div>
          <div className="mt-1 text-sm text-slate-600">
            Tips: good lighting, no glare, and make sure text is readable. Your ID is never shown publicly.
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <Label>Ghana Card (front)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setIdFront(e.target.files?.[0] ?? null)} disabled={busy} />
            </div>
            <div>
              <Label>Ghana Card (back) (optional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setIdBack(e.target.files?.[0] ?? null)} disabled={busy} />
            </div>
            <div>
              <Label>Selfie</Label>
              <Input type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] ?? null)} disabled={busy} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={submit} disabled={busy || !canVerify}>
              {busy ? 'Submitting…' : 'Submit for review'}
            </Button>
            <Button variant="secondary" onClick={refresh} disabled={busy}>
              Refresh status
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

