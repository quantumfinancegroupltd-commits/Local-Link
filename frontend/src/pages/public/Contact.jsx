import { Card } from '../../components/ui/FormControls.jsx'

export function Contact() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700">Company</div>
        <h1 className="mt-2 text-2xl font-bold">Contact</h1>
        <p className="mt-3 text-sm text-slate-700">
          We’re keeping support simple and signal-only for MVP. Use the channels below.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">Email</div>
            <a className="mt-1 block text-sm text-emerald-700 underline" href="mailto:support@locallink.local">
              support@locallink.local
            </a>
            <div className="mt-2 text-xs text-slate-600">Change this address when you connect your domain.</div>
          </div>
          <div className="rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold">WhatsApp</div>
            <div className="mt-1 text-sm text-slate-700">Coming soon (offline-first support).</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold">For issues</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            <li>Include a screenshot and the time it happened.</li>
            <li>If it’s a payment/dispute issue, include the job/order ID.</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}


