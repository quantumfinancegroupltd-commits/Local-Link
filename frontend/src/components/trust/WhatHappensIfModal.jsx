import { Button, Card } from '../ui/FormControls.jsx'

function Content({ context }) {
  const c = String(context || 'general')

  if (c === 'job') {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">What happens if… (Jobs)</div>
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold">…the artisan doesn’t show up?</div>
          <div className="mt-1">Cancel before work starts. If you already funded escrow, it will be refunded unless there’s an active dispute.</div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold">…the job isn’t completed properly?</div>
          <div className="mt-1">Open a dispute from your Trust Wallet. Escrow is frozen while support reviews evidence.</div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold">…the work is completed?</div>
          <div className="mt-1">You confirm completion and funds are released. Your review updates trust for future buyers.</div>
        </div>
      </div>
    )
  }

  if (c === 'produce') {
    return (
      <div className="space-y-3 text-sm text-slate-700">
        <div className="font-semibold text-slate-900">What happens if… (Produce)</div>
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold">…produce quality is not as described?</div>
          <div className="mt-1">Open a dispute with photos/video evidence. Support can refund, release, or split fairly.</div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold">…delivery is late?</div>
          <div className="mt-1">You can track status and contact the driver. If it’s seriously delayed, open a dispute.</div>
        </div>
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold">…everything arrives correctly?</div>
          <div className="mt-1">Confirm delivery; escrow releases automatically (or after auto-confirm window if you don’t respond).</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div className="font-semibold text-slate-900">What happens if…</div>
      <div className="rounded-xl border bg-slate-50 p-3">
        <div className="font-semibold">If something goes wrong</div>
        <div className="mt-1">Open a dispute from the relevant transaction. Escrow is held while support reviews evidence.</div>
      </div>
    </div>
  )
}

export function WhatHappensIfModal({ open, onClose, context }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
        <Card className="p-5">
          <Content context={context} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}


