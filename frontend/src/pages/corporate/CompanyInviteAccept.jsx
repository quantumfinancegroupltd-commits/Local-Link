import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Card, Button } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useToast } from '../../components/ui/Toast.jsx'

export function CompanyInviteAccept() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = useMemo(() => String(params.get('token') || '').trim(), [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!token) {
        setLoading(false)
        setError('Missing invite token.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const r = await http.post('/corporate/company/invites/accept', { token })
        const companyId = r?.data?.company_id ? String(r.data.company_id) : ''
        if (cancelled) return
        setOk(true)
        toast.success('Invite accepted', 'Welcome to the workspace.')
        const qs = new URLSearchParams()
        qs.set('tab', 'insights')
        if (companyId) qs.set('company_id', companyId)
        navigate(`/company?${qs.toString()}`, { replace: true })
      } catch (e) {
        if (cancelled) return
        setOk(false)
        setError(e?.response?.data?.message ?? e?.message ?? 'Failed to accept invite')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [token, navigate, toast])

  return (
    <div className="mx-auto max-w-3xl p-4">
      <PageHeader kicker="Employers" title="Accept invite" subtitle="Joining a company workspace…" />
      <Card className="p-5">
        {loading ? <div className="text-sm text-slate-600">Working…</div> : null}
        {error ? (
          <div className="text-sm text-red-700">
            {error}
            <div className="mt-3">
              <Button variant="secondary" onClick={() => navigate('/company', { replace: true })}>
                Go to company dashboard
              </Button>
            </div>
          </div>
        ) : null}
        {!loading && ok ? <div className="text-sm text-emerald-700">Accepted.</div> : null}
      </Card>
    </div>
  )
}

