import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label } from '../../components/ui/FormControls.jsx'

function Step({ title, active, done, children }) {
  const dot = done ? 'bg-emerald-600' : active ? 'bg-orange-500' : 'bg-slate-300'
  return (
    <div className="flex gap-3">
      <div className="pt-1">
        <div className={`h-3 w-3 rounded-full ${dot}`} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
      </div>
    </div>
  )
}

export function BuyerJobEscrow() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [deposit, setDeposit] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get(`/jobs/${id}`)
        if (!cancelled) setJob(res.data?.job ?? res.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load job')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const accepted = useMemo(() => Number(job?.accepted_quote ?? job?.acceptedQuote ?? 0), [job])

  // Phase 1 placeholder state (backend integration comes next)
  const escrowStatus = 'not_started' // not_started | funded | released

  const suggested = useMemo(() => {
    if (!accepted) return ''
    // common deposit pattern: 30%
    return String(Math.max(1, Math.round(accepted * 0.3)))
  }, [accepted])

  useEffect(() => {
    if (!deposit && suggested) setDeposit(suggested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested])

  const step1Active = escrowStatus === 'not_started'
  const step2Active = escrowStatus === 'funded'
  const step3Active = escrowStatus === 'released'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trust Wallet (Escrow)</h1>
          <p className="text-sm text-slate-600">
            Funds are held by LocalLink and released only when you confirm milestones/completion.
          </p>
        </div>
        <Link to={`/buyer/jobs/${id}`}>
          <Button variant="secondary">Back to job</Button>
        </Link>
      </div>

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{job?.title || 'Job'}</div>
                <div className="mt-1 text-sm text-slate-600">{job?.location || '—'}</div>
              </div>
              <div className="text-xs font-medium text-slate-700">{job?.status || 'open'}</div>
            </div>
            {accepted ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Accepted quote</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">GHS {accepted}</div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-600">
                Accept a quote first — then you can fund escrow.
              </div>
            )}
          </Card>

          <Card>
            <div className="text-sm font-semibold">Escrow flow</div>
            <div className="mt-4 space-y-4">
              <Step title="1) Fund deposit" active={step1Active} done={escrowStatus !== 'not_started'}>
                Buyer pays deposit into LocalLink Trust Wallet (Paystack/Flutterwave).
              </Step>
              <Step title="2) Work in progress" active={step2Active} done={escrowStatus === 'released'}>
                Funds are held until buyer confirms milestone/completion.
              </Step>
              <Step title="3) Release payout" active={step3Active} done={escrowStatus === 'released'}>
                LocalLink releases funds to artisan minus platform fee.
              </Step>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Fund deposit</div>
            <div className="mt-2 text-sm text-slate-600">
              Phase 1 UI: escrow endpoints will be added next. For now this defines the exact flow we’ll implement.
            </div>

            <div className="mt-4 max-w-xs">
              <Label>Deposit amount (GHS)</Label>
              <Input
                value={deposit}
                onChange={(e) => setDeposit(e.target.value)}
                type="number"
                min="1"
                disabled={!accepted}
              />
              {accepted ? (
                <div className="mt-2 text-xs text-slate-500">Suggested: ~30% of accepted quote.</div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled title="Coming soon">
                Pay deposit (Paystack/Flutterwave)
              </Button>
              <Button variant="secondary" disabled title="Coming soon">
                Release funds
              </Button>
              <Button variant="secondary" disabled title="Coming soon">
                Open dispute
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}


