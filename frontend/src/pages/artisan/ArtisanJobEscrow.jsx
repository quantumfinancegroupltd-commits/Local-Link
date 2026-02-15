import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { StatusPill } from '../../components/ui/StatusPill.jsx'
import { StatusTimeline } from '../../components/ui/StatusTimeline.jsx'
import { buildEscrowTimeline } from '../../lib/statusTimelines.js'

export function ArtisanJobEscrow() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [txLoading, setTxLoading] = useState(false)
  const [txError, setTxError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [polling, setPolling] = useState(false)
  const pollCountRef = useRef(0)

  const [disputeBusy, setDisputeBusy] = useState(false)
  const [disputeError, setDisputeError] = useState(null)
  const [disputeOk, setDisputeOk] = useState(null)
  const [disputeReason, setDisputeReason] = useState('work_not_completed')
  const [disputeDetails, setDisputeDetails] = useState('')
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState([])

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

  const loadTx = useCallback(async () => {
    setTxLoading(true)
    setTxError(null)
    try {
      const res = await http.get(`/escrow/jobs/${id}`)
      setTransactions(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setTxError(err?.response?.data?.message ?? err?.message ?? 'Failed to load escrow history')
    } finally {
      setTxLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTx().catch(() => {})
  }, [loadTx])

  const accepted = useMemo(() => Number(job?.accepted_quote ?? job?.acceptedQuote ?? 0), [job])
  const latest = transactions?.[0] ?? null
  const escrowStatus = latest?.status ?? 'not_started'
  const disputeStatus = latest?.dispute?.status ?? null
  const escrowTimeline = useMemo(() => buildEscrowTimeline(escrowStatus), [escrowStatus])

  const nextStep = useMemo(() => {
    if (!accepted) {
      return {
        variant: 'info',
        title: 'Next: get a quote accepted',
        description: 'Escrow begins after the buyer accepts a quote and pays a deposit.',
        actions: (
          <Link to={`/artisan/jobs/${id}`}>
            <Button variant="secondary">Back to job</Button>
          </Link>
        ),
      }
    }
    if (escrowStatus === 'not_started' || escrowStatus === 'created' || escrowStatus === 'cancelled' || escrowStatus === 'failed') {
      return {
        variant: 'warning',
        title: 'Waiting for deposit',
        description: 'Ask the buyer to fund escrow so you can safely begin work.',
        actions: (
          <Link to={`/messages/job/${id}`}>
            <Button variant="secondary">Message buyer</Button>
          </Link>
        ),
      }
    }
    if (escrowStatus === 'pending_payment') {
      return {
        variant: 'info',
        title: 'Payment pending',
        description: 'Escrow will move to held once payment is confirmed.',
        actions: (
          <Button variant="secondary" onClick={() => loadTx().catch(() => {})} disabled={txLoading}>
            {txLoading ? 'Refreshing…' : 'Refresh status'}
          </Button>
        ),
      }
    }
    if (escrowStatus === 'held' || escrowStatus === 'in_progress') {
      return {
        variant: 'success',
        title: 'Escrow funded',
        description: 'Do the work. When finished, mark the job completed to trigger buyer confirmation/release.',
        actions: (
          <Link to={`/artisan/jobs/${id}`}>
            <Button variant="secondary">Open job</Button>
          </Link>
        ),
      }
    }
    if (escrowStatus === 'completed_pending_confirmation') {
      return {
        variant: 'warning',
        title: 'Waiting for buyer confirmation',
        description: 'If everything is done, ask the buyer to release funds. If there’s an issue, open a dispute to freeze escrow.',
        actions: (
          <div className="flex flex-wrap gap-2">
            <Link to={`/messages/job/${id}`}>
              <Button variant="secondary">Message buyer</Button>
            </Link>
            <Button variant="secondary" onClick={() => document.getElementById('dispute')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Open dispute
            </Button>
          </div>
        ),
      }
    }
    if (escrowStatus === 'released') {
      return {
        variant: 'success',
        title: 'Paid',
        description: 'Escrow was released. Your wallet balance should reflect the payout (minus platform fee).',
        actions: (
          <Link to="/artisan">
            <Button variant="secondary">Back to dashboard</Button>
          </Link>
        ),
      }
    }
    if (escrowStatus === 'disputed') {
      const statusLabel = disputeStatus === 'open' ? 'Open' : disputeStatus === 'under_review' ? 'Under review' : disputeStatus === 'resolved' ? 'Resolved' : disputeStatus
      const nextDesc =
        disputeStatus === 'open'
          ? 'Admin will review shortly. No action needed.'
          : disputeStatus === 'under_review'
            ? 'Admin is reviewing. You’ll be notified when resolved.'
            : disputeStatus === 'resolved'
              ? 'Resolved. Payout applied per admin decision.'
              : disputeStatus === 'rejected'
                ? 'Dispute was closed. Check resolution.'
                : 'Escrow is frozen while the dispute is reviewed.'
      return {
        variant: 'warning',
        title: `Dispute: ${statusLabel}`,
        description: nextDesc,
      }
    }
    return null
  }, [accepted, escrowStatus, id, loadTx, txLoading])

  useEffect(() => {
    pollCountRef.current = 0
    if (escrowStatus !== 'pending_payment') {
      setPolling(false)
      return
    }
    setPolling(true)
    const intervalMs = 3000
    const maxPolls = 40
    const t = setInterval(async () => {
      pollCountRef.current += 1
      await loadTx().catch(() => {})
      if (pollCountRef.current >= maxPolls) {
        setPolling(false)
        clearInterval(t)
      }
    }, intervalMs)
    return () => clearInterval(t)
  }, [escrowStatus, loadTx])

  async function openDispute() {
    setDisputeBusy(true)
    setDisputeError(null)
    setDisputeOk(null)
    try {
      let evidence = null
      if (disputeEvidenceFiles.length) {
        const uploaded = await uploadMediaFiles(disputeEvidenceFiles)
        const urls = uploaded.map((f) => f.url).filter(Boolean)
        evidence = urls.length ? { files: urls } : null
      }
      await http.post(`/escrow/jobs/${id}/dispute`, {
        reason: disputeReason,
        details: disputeDetails || null,
        evidence,
      })
      setDisputeOk('Dispute opened. An admin will review it.')
      await loadTx().catch(() => {})
    } catch (err) {
      setDisputeError(err?.response?.data?.message ?? err?.message ?? 'Failed to open dispute')
    } finally {
      setDisputeBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        kicker="Trust Wallet"
        title="Escrow"
        subtitle="See payment status and protect your payout."
        actions={
          <>
            <StatusPill status={txLoading ? 'loading' : txError ? 'unknown' : escrowStatus} label={txLoading ? 'Loading…' : txError ? 'Unknown' : escrowStatus} />
            <Link to={`/artisan/jobs/${id}`}>
              <Button variant="secondary">Back to job</Button>
            </Link>
          </>
        }
      />

      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : (
        <>
          {nextStep ? <NextStepBanner variant={nextStep.variant} title={nextStep.title} description={nextStep.description} actions={nextStep.actions} /> : null}

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Escrow timeline</div>
                <div className="mt-1 text-xs text-slate-600">
                  {polling ? 'Live updating…' : ' '}
                </div>
              </div>
              <Button variant="secondary" onClick={() => loadTx().catch(() => {})} disabled={txLoading}>
                {txLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
            <div className="mt-4">
              <StatusTimeline steps={escrowTimeline.steps} activeKey={escrowTimeline.activeKey} compact />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Accepted quote</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{accepted ? `GHS ${accepted.toFixed(0)}` : '—'}</div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Latest escrow amount</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {latest?.amount != null ? `${latest.currency ?? 'GHS'} ${Number(latest.amount).toFixed(0)}` : '—'}
                </div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Platform fee</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{latest?.platform_fee != null ? `GHS ${Number(latest.platform_fee).toFixed(0)}` : '—'}</div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Escrow history</div>
            {txError ? <div className="mt-2 text-sm text-red-700">{txError}</div> : null}
            {txLoading && transactions.length === 0 ? <div className="mt-2 text-sm text-slate-600">Loading…</div> : null}
            {!txLoading && transactions.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">No escrow transactions yet.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Provider</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.slice(0, 20).map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 pr-3 text-slate-700">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</td>
                        <td className="py-2 pr-3">
                          <StatusPill status={t.status} label={t.status} />
                        </td>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {(t.currency ?? 'GHS') + ' ' + Number(t.amount ?? 0).toFixed(0)}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{t.provider ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card id="dispute">
            <div className="text-sm font-semibold">Dispute</div>
            <div className="mt-1 text-sm text-slate-600">Open a dispute to freeze escrow and request admin review.</div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <Label>Reason</Label>
                <Select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}>
                  <option value="work_not_completed">Work not completed</option>
                  <option value="poor_quality">Poor quality</option>
                  <option value="late_delivery">Late delivery</option>
                  <option value="communication_issue">Communication issue</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label>Evidence (optional)</Label>
                <Input type="file" multiple accept="image/*,video/*" onChange={(e) => setDisputeEvidenceFiles(Array.from(e.target.files || []))} />
                {disputeEvidenceFiles.length ? (
                  <div className="mt-1 text-xs text-slate-600">
                    Selected: {disputeEvidenceFiles.map((f) => f.name).slice(0, 4).join(', ')}
                    {disputeEvidenceFiles.length > 4 ? ` (+${disputeEvidenceFiles.length - 4} more)` : ''}
                  </div>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <Label>Details (optional)</Label>
                <Textarea value={disputeDetails} onChange={(e) => setDisputeDetails(e.target.value)} rows={3} placeholder="Explain the issue briefly…" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={disputeBusy || escrowStatus === 'released'} onClick={openDispute}>
                {disputeBusy ? 'Opening…' : 'Open dispute'}
              </Button>
              <Link to={`/messages/job/${id}`}>
                <Button variant="secondary">Message buyer</Button>
              </Link>
            </div>

            {disputeError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{disputeError}</div> : null}
            {disputeOk ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{disputeOk}</div> : null}
          </Card>
        </>
      )}
    </div>
  )
}

