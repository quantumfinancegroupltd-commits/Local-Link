import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function TrustVerification() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700">Trust</div>
        <h1 className="mt-2 text-2xl font-bold">Verification tiers</h1>
        <p className="mt-3 text-sm text-slate-700">
          Verification is designed to be simple, fair, and hard to game. Tiers help buyers decide who to trust—especially for
          high-risk categories like domestic services.
        </p>

        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Unverified</div>
            <div className="mt-2 text-sm text-slate-700">Basic account. Limited trust signals. Providers cannot accept paid work or withdraw payouts until verified.</div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Bronze</div>
            <div className="mt-2 text-sm text-slate-700">Entry verification (ID verified) + early history. Required for accepting paid work and listing produce.</div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Silver</div>
            <div className="mt-2 text-sm text-slate-700">Stronger verification + proven outcomes.</div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Gold</div>
            <div className="mt-2 text-sm text-slate-700">Highest trust tier. Best for recurring/high-stakes work.</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
          <div className="text-sm font-semibold">How to move up</div>
          <div className="mt-2 space-y-3 text-sm text-slate-700">
            <p>
              <strong>Unverified → Bronze:</strong> Submit Ghana Card (ID) verification. Providers must verify to accept paid work, list produce, and withdraw payouts.
            </p>
            <p>
              <strong>Bronze → Silver / Gold:</strong> Complete jobs or orders, earn positive reviews, and submit additional verification evidence via your profile.
            </p>
            <p>Each tier unlocks more visibility and trust.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/verify">
              <Button>Verify with Ghana Card (providers)</Button>
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/trust/escrow">
            <Button variant="secondary">How escrow works</Button>
          </Link>
          <Link to="/trust/reviews">
            <Button variant="secondary">How reviews work</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}


