import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function TrustEscrow() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700">Trust</div>
        <h1 className="mt-2 text-2xl font-bold">How escrow works</h1>
        <p className="mt-3 text-sm text-slate-700">
          Escrow (Trust Wallet) means your money is held safely until the job is completed or delivery is confirmed. It protects
          both sides and makes outcomes predictable.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Skilled labour (jobs)</div>
            <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
              <li>You post a job and accept a quote.</li>
              <li>You fund escrow (deposit/amount held).</li>
              <li>Provider completes the job.</li>
              <li>You confirm and funds are released (minus platform fee).</li>
            </ol>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Produce + delivery (orders)</div>
            <ol className="mt-2 list-decimal pl-5 text-sm text-slate-700">
              <li>You place an order (produce + delivery fee).</li>
              <li>Escrow holds the funds.</li>
              <li>Delivery happens (driver updates status).</li>
              <li>You confirm delivery and funds release to farmer + driver.</li>
            </ol>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold">Disputes</div>
          <div className="mt-2 text-sm text-slate-700">
            If something goes wrong, you can open a dispute with evidence. Escrow is frozen until an admin resolves it fairly.
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
          <div className="text-sm font-semibold">How trust scores work</div>
          <div className="mt-2 text-sm text-slate-700">
            Trust scores (0–100) reflect verified outcomes: completed jobs, delivered orders, positive reviews. Higher scores mean
            more reliable providers. New accounts start low and build trust over time. Verification tiers (Bronze, Silver, Gold) add
            extra confidence for high-stakes work.
          </div>
          <Link to="/trust/verification">
            <span className="mt-2 inline-block text-sm font-semibold text-emerald-700">Learn about verification tiers →</span>
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/trust/verification">
            <Button variant="secondary">Verification tiers</Button>
          </Link>
          <Link to="/trust/reviews">
            <Button variant="secondary">How reviews work</Button>
          </Link>
          <Link to="/register?role=buyer&intent=fix">
            <Button>Post a job</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}


