import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function PaystackCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const reference = params.get('reference')
  const jobId = params.get('jobId')
  const orderId = params.get('orderId')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function verify() {
      setLoading(true)
      setError(null)
      try {
        if (!reference) throw new Error('Missing Paystack reference')
        const res = await http.get(`/escrow/paystack/verify/${encodeURIComponent(reference)}`)
        const s = res.data?.escrow?.status ?? null
        if (!cancelled) setStatus(s)
        // Redirect after a short moment
        if (!cancelled) {
          setTimeout(() => {
            if (jobId) return navigate(`/buyer/jobs/${jobId}/escrow`, { replace: true })
            if (orderId) return navigate(`/buyer/orders`, { replace: true })
            return navigate('/buyer', { replace: true })
          }, 900)
        }
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Verification failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    verify()
    return () => {
      cancelled = true
    }
  }, [reference, jobId, orderId, navigate])

  return (
    <div className="mx-auto max-w-xl">
      <Card className="p-6">
        <h1 className="text-xl font-bold">Confirming payment…</h1>
        <p className="mt-2 text-sm text-slate-600">
          We’re verifying your Paystack payment and updating your Trust Wallet.
        </p>

        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Please wait…</div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Payment status: <span className="font-semibold">{status ?? 'updated'}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {jobId ? (
            <Link to={`/buyer/jobs/${jobId}/escrow`}>
              <Button variant="secondary">Back to Trust Wallet</Button>
            </Link>
          ) : orderId ? (
            <Link to="/buyer/orders">
              <Button variant="secondary">Back to my orders</Button>
            </Link>
          ) : (
            <Link to="/buyer">
              <Button variant="secondary">Go to dashboard</Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  )
}


