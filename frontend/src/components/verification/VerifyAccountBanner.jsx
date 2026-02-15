import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button } from '../ui/FormControls.jsx'
import { NextStepBanner } from '../ui/NextStepBanner.jsx'

function statusLabel(s) {
  if (s === 'pending') return 'Pending review'
  if (s === 'approved') return 'Approved'
  if (s === 'needs_correction') return 'Needs correction'
  if (s === 'rejected') return 'Rejected'
  return 'Not submitted'
}

export function VerifyAccountBanner({ className = '' }) {
  const { user } = useAuth()
  const location = useLocation()

  const isProvider = useMemo(() => ['artisan', 'farmer', 'driver'].includes(user?.role), [user?.role])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(null) // { id_verified, latest_request }

  async function refresh() {
    if (!isProvider) return
    setLoading(true)
    try {
      const res = await http.get('/id-verification/status')
      setStatus(res.data ?? null)
    } catch {
      // best-effort; if this fails we don't block the dashboard render
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProvider])

  // Don't show banner on the verification page itself.
  if (String(location?.pathname || '').startsWith('/verify')) return null
  if (!isProvider) return null
  if (loading) return null

  const idVerified = Boolean(status?.id_verified)
  if (idVerified) return null

  const latest = status?.latest_request ?? null
  const st = latest?.status ?? null
  const reason = latest?.rejection_reason ?? null

  const variant = st === 'needs_correction' || st === 'rejected' ? 'danger' : st === 'pending' ? 'info' : 'warning'
  const title =
    st === 'pending'
      ? 'Verification in review'
      : st === 'needs_correction'
        ? 'Action needed: re-upload your Ghana Card'
        : st === 'rejected'
          ? 'Verification rejected'
          : 'Verify your account to accept paid work'

  const description =
    st === 'pending'
      ? 'You’ll be able to accept paid work and withdraw funds once approved (usually within 24 hours).'
      : st === 'needs_correction'
        ? `Reason: ${reason || 'Please re-upload clearer images and a selfie.'}`
        : st === 'rejected'
          ? `Reason: ${reason || 'Please resubmit with clearer images and a matching selfie.'}`
          : `Get verified to move from Unverified → Bronze. Required to accept paid jobs, list produce, claim deliveries, and withdraw payouts.`

  return (
    <NextStepBanner
      className={className}
      variant={variant}
      title={title}
      description={description}
      actions={
        <>
          <Link to="/verify">
            <Button>Verify now</Button>
          </Link>
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
        </>
      }
    />
  )
}

