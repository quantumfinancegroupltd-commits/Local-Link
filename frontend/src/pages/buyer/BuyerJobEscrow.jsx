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
import { WhatHappensIfModal } from '../../components/trust/WhatHappensIfModal.jsx'
import { StickyActionBar } from '../../components/ui/StickyActionBar.jsx'

export function BuyerJobEscrow() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [txLoading, setTxLoading] = useState(false)
  const [txError, setTxError] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [polling, setPolling] = useState(false)
  const pollCountRef = useRef(0)

  const [deposit, setDeposit] = useState('')
  const [payBusy, setPayBusy] = useState(false)
  const [payError, setPayError] = useState(null)
  const [disputeBusy, setDisputeBusy] = useState(false)
  const [disputeError, setDisputeError] = useState(null)
  const [disputeOk, setDisputeOk] = useState(null)
  const [disputeReason, setDisputeReason] = useState('work_not_completed')
  const [disputeDetails, setDisputeDetails] = useState('')
  const [disputeEvidenceFiles, setDisputeEvidenceFiles] = useState([])
  const [whatIfOpen, setWhatIfOpen] = useState(false)

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
    loadTx()
  }, [loadTx])

  const accepted = useMemo(() => Number(job?.accepted_quote ?? job?.acceptedQuote ?? 0), [job])

  const latest = transactions?.[0] ?? null
  const escrowStatus = latest?.status ?? 'not_started' // not_started | pending_payment | held | released | ...
  const disputeStatus = latest?.dispute?.status ?? null
  const escrowTimeline = useMemo(() => buildEscrowTimeline(escrowStatus), [escrowStatus])

  const nextStep = useMemo(() => {
    if (!accepted) {
      return {
        variant: 'info',
        title: 'Next: accept a quote first',
        description: 'Escrow is available after you accept a quote.',
        actions: (
          <Link to={`/buyer/jobs/${id}`}>
            <Button variant="secondary">Back to quotes</Button>
          </Link>
        ),
      }
    }
    if (escrowStatus === 'not_started' || escrowStatus === 'created' || escrowStatus === 'cancelled' || escrowStatus === 'failed') {
      return {
        variant: 'success',
        title: 'Next: pay your deposit',
        description: 'Once payment succeeds, the escrow moves to held.',
        actions: <Button onClick={payDepositPaystack} disabled={payBusy}>{payBusy ? 'Redirecting…' : 'Pay deposit'}</Button>,
      }
    }
    if (escrowStatus === 'pending_payment') {
      return {
        variant: 'warning',
        title: 'Next: complete payment in Paystack',
        description: 'This page will auto-update once payment is confirmed.',
        actions: (
          <Button variant="secondary" onClick={loadTx} disabled={txLoading}>
            {txLoading ? 'Refreshing…' : 'Refresh status'}
          </Button>
        ),
      }
    }
    if (escrowStatus === 'held' || escrowStatus === 'in_progress') {
      return {
        variant: 'info',
        title: 'Next: wait for the artisan to mark completed',
        description: 'When the artisan marks completed, you’ll be able to release funds (or open a dispute).',
      }
    }
    if (escrowStatus === 'completed_pending_confirmation') {
      return {
        variant: 'warning',
        title: 'Next: release funds (or open a dispute)',
        description: 'If the work is done, release funds. If not, open a dispute to freeze escrow.',
      }
    }
    if (escrowStatus === 'released') {
      return {
        variant: 'success',
        title: 'Next: leave a review',
        description: 'Reviews improve trust for future matches.',
        actions: (
          <Link to={`/buyer/jobs/${encodeURIComponent(id)}`}>
            <Button variant="secondary">Leave review</Button>
          </Link>
        ),
      }
    }
    return null
  }, [accepted, escrowStatus, id, loadTx, payBusy, payDepositPaystack, txLoading])

  const showStickyPay = useMemo(() => {
    if (!accepted) return false
    return ['not_started', 'created', 'cancelled', 'failed'].includes(String(escrowStatus))
  }, [accepted, escrowStatus])

  const suggested = useMemo(() => {
    if (!accepted) return ''
    // common deposit pattern: 30%
    return String(Math.max(1, Math.round(accepted * 0.3)))
  }, [accepted])

  useEffect(() => {
    if (!deposit && suggested) setDeposit(suggested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested])

  // Poll escrow status while payment is pending (Airbnb-like “live update” feel)
  useEffect(() => {
    pollCountRef.current = 0
    if (escrowStatus !== 'pending_payment') {
      setPolling(false)
      return
    }

    setPolling(true)
    const intervalMs = 3000
    const maxPolls = 40 // ~2 minutes
    const t = setInterval(async () => {
      pollCountRef.current += 1
      await loadTx()
      if (pollCountRef.current >= maxPolls) {
        setPolling(false)
        clearInterval(t)
      }
    }, intervalMs)

    return () => clearInterval(t)
  }, [escrowStatus, loadTx])

  async function payDepositPaystack() {
    setPayBusy(true)
    setPayError(null)
    try {
      const amount = Number(deposit)
      if (!Number.isFinite(amount) || amount <= 0) {
        setPayError('Enter a valid deposit amount.')
        return
      }

      const res = await http.post(`/escrow/jobs/${id}/deposit`, { amount, provider: 'paystack' })
      const url = res.data?.paystack?.authorization_url
      if (!url) {
        setPayError('Paystack did not return an authorization URL.')
        return
      }
      window.location.assign(url)
    } catch (err) {
      // 501 returns { message, escrow } when not configured
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to start Paystack payment'
      setPayError(msg)
    } finally {
      setPayBusy(false)
    }
  }

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
      await loadTx()
    } catch (err) {
      setDisputeError(err?.response?.data?.message ?? err?.message ?? 'Failed to open dispute')
    } finally {
      setDisputeBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <WhatHappensIfModal open={whatIfOpen} onClose={() => setWhatIfOpen(false)} context="job" />
      <PageHeader
        kicker="Trust Wallet"
        title="Escrow"
        subtitle="Funds are held by LocalLink and released only when you confirm milestones/completion."
        actions={
          <>
            <StatusPill status={txLoading ? 'loading' : txError ? 'unknown' : escrowStatus} label={txLoading ? 'Loading…' : txError ? 'Unknown' : escrowStatus} />
            <Link to={`/buyer/jobs/${id}`}>
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
          {nextStep ? (
            <NextStepBanner
              variant={nextStep.variant}
              title={nextStep.title}
              description={nextStep.description}
              actions={nextStep.actions}
            />
          ) : null}

          {showStickyPay ? (
            <StickyActionBar
              left={
                <div className="text-xs text-slate-700">
                  Deposit: <span className="font-semibold">GHS {deposit || suggested || '—'}</span>
                </div>
              }
              right={
                <Button onClick={payDepositPaystack} disabled={payBusy}>
                  {payBusy ? 'Redirecting…' : 'Pay deposit'}
                </Button>
              }
            />
          ) : null}

          <Card>
            <div className="text-sm font-semibold">Certainty</div>
            <div className="mt-2 text-sm text-slate-700">
              🔒 Escrow protects your payment. 🛡️ If something goes wrong, open a dispute to freeze escrow for review.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setWhatIfOpen(true)}>
                What happens if…?
              </Button>
              <Link to="/trust/escrow">
                <Button variant="secondary">Policy</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{job?.title || 'Job'}</div>
                <div className="mt-1 text-sm text-slate-600">{job?.location || '—'}</div>
                {job?.scheduled_at ? (
                  <div className="mt-1 text-xs text-slate-600">
                    📅 Your deposit secures the booking for {new Date(job.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
                  </div>
                ) : null}
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
            <div className="mt-4">
              <StatusTimeline steps={escrowTimeline.steps} />
            </div>
            {escrowTimeline.banner ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {escrowTimeline.banner}
                {escrowStatus === 'disputed' && disputeStatus ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="font-medium text-slate-900">
                      Dispute: {disputeStatus === 'open' ? 'Open' : disputeStatus === 'under_review' ? 'Under review' : disputeStatus === 'resolved' ? 'Resolved' : disputeStatus}
                    </div>
                    <div className="mt-1 text-slate-600">
                      {disputeStatus === 'open' && 'Admin will review shortly. No action needed.'}
                      {disputeStatus === 'under_review' && 'Admin is reviewing. You’ll be notified when resolved.'}
                      {disputeStatus === 'resolved' && 'Resolved. Funds released per admin decision.'}
                      {disputeStatus === 'rejected' && 'Dispute was closed. Check the resolution.'}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 text-sm text-slate-600">
              Current status:{' '}
              <span className="font-semibold text-slate-900">
                {txLoading ? 'Loading…' : txError ? 'Unknown' : escrowStatus}
              </span>
              {polling ? <span className="ml-2 text-xs text-slate-500">(Auto-updating…)</span> : null}
            </div>
            {txError ? <div className="mt-2 text-sm text-red-700">{txError}</div> : null}
            <div className="mt-3">
              <Button variant="secondary" onClick={loadTx} disabled={txLoading}>
                {txLoading ? 'Refreshing…' : 'Refresh status'}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Fund deposit</div>
            <div className="mt-2 text-sm text-slate-600">
              Paystack checkout is now wired. Once payment succeeds, the escrow moves to <span className="font-semibold">held</span>.
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

            {payError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {payError}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={!accepted || payBusy} onClick={payDepositPaystack}>
                {payBusy ? 'Redirecting…' : 'Pay deposit (Paystack)'}
              </Button>
              <Button
                variant="secondary"
                disabled={escrowStatus !== 'completed_pending_confirmation' || payBusy}
                onClick={async () => {
                  try {
                    await http.post(`/escrow/jobs/${id}/release`)
                    await loadTx()
                  } catch (err) {
                    setPayError(err?.response?.data?.message ?? err?.message ?? 'Failed to release funds')
                  }
                }}
                title={escrowStatus !== 'completed_pending_confirmation' ? 'Available when artisan marks job completed' : ''}
              >
                Release funds
              </Button>
              {escrowStatus === 'released' ? (
                <Link to={`/buyer/jobs/${encodeURIComponent(id)}`}>
                  <Button variant="secondary">Leave review</Button>
                </Link>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Dispute</div>
            <div className="mt-2 text-sm text-slate-600">
              If there’s a serious issue before payout is released, open a dispute to freeze funds for admin review.
            </div>
            <div className="mt-2 text-xs text-slate-500">Note: any work proof (before/after photos) uploaded for this job is attached automatically.</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <Label>Reason</Label>
                <Select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)}>
                  <option value="work_not_completed">Work not completed</option>
                  <option value="poor_quality">Poor quality</option>
                  <option value="late_delivery">Late delivery</option>
                  <option value="wrong_item">Wrong item</option>
                  <option value="communication_issue">Communication issue</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label>Details (optional)</Label>
                <Textarea value={disputeDetails} onChange={(e) => setDisputeDetails(e.target.value)} rows={3} />
              </div>
            </div>
            <div className="mt-4">
              <Label>Evidence (optional)</Label>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="font-semibold">Evidence checklist (recommended)</div>
                <ul className="mt-2 space-y-1">
                  <li>- Photos/videos of the work (before/after)</li>
                  <li>- Clear description of what’s missing or wrong</li>
                  <li>- Any receipts/material invoices (if applicable)</li>
                  <li>- Chat context (keep it in-app)</li>
                </ul>
                <div className="mt-2 text-slate-600">
                  Tip: disputes with evidence usually resolve faster.
                </div>
              </div>
              <Input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => setDisputeEvidenceFiles(Array.from(e.target.files ?? []))}
                disabled={disputeBusy}
              />
              <div className="mt-2 text-xs text-slate-500">Upload photos/videos (max 50MB per file).</div>
              {disputeEvidenceFiles.length ? (
                <div className="mt-2 text-xs text-slate-600">
                  Selected: {disputeEvidenceFiles.map((f) => f.name).slice(0, 6).join(', ')}
                  {disputeEvidenceFiles.length > 6 ? ` (+${disputeEvidenceFiles.length - 6} more)` : ''}
                </div>
              ) : null}
            </div>
            {disputeError ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{disputeError}</div>
            ) : null}
            {disputeOk ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                {disputeOk}
              </div>
            ) : null}
            <div className="mt-4">
              <Button variant="secondary" disabled={disputeBusy || escrowStatus === 'released'} onClick={openDispute}>
                {disputeBusy ? 'Opening…' : 'Open dispute'}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}


