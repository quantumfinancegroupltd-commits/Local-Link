import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function TrustReviews() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700">Trust</div>
        <h1 className="mt-2 text-2xl font-bold">How reviews work</h1>
        <p className="mt-3 text-sm text-slate-700">
          Reviews are tied to real transactions so they represent real outcomes—not marketing. This prevents fake reputation.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Jobs</div>
            <div className="mt-2 text-sm text-slate-700">
              Buyers can review an artisan after escrow is released (job is completed and paid out).
            </div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Orders</div>
            <div className="mt-2 text-sm text-slate-700">
              Buyers can review the farmer/florist or driver after delivery is confirmed (delivery is settled).
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/trust/escrow">
            <Button variant="secondary">How escrow works</Button>
          </Link>
          <Link to="/trust/verification">
            <Button variant="secondary">Verification tiers</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}


