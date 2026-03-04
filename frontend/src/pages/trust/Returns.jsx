import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function TrustReturns() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-400">Trust</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Returns & refunds</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-400">
          We want you to be satisfied. If you received produce that is damaged, wrong, or not as described, or if you need to cancel before fulfilment, this page explains your options.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Before delivery</div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
              You can cancel an order before it is confirmed or dispatched. If payment was taken, we will refund to your original payment method (or wallet) once the cancellation is processed. Refunds typically appear within 5–10 business days.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">After delivery</div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
              If the produce arrived damaged, wrong, or not as described, request a return or refund via support. Open a support ticket and choose category &quot;Orders&quot; with subject &quot;Return/refund request&quot; and your order ID. Include a short description and, if possible, a photo. Our team will review and either arrange a partial/full refund or a replacement where appropriate.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Disputes</div>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
              For serious issues (e.g. non-delivery, major quality problems), you can open a dispute on the order. Escrow is frozen until an admin reviews the evidence and resolves fairly. See <Link to="/trust/escrow" className="font-medium text-emerald-700 dark:text-emerald-400 hover:underline">How escrow works</Link> for more.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/support">
            <Button>Request return or refund</Button>
          </Link>
          <Link to="/trust/escrow">
            <Button variant="secondary">How escrow works</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
