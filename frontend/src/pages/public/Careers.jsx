import { Card } from '../../components/ui/FormControls.jsx'

export function Careers() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700">Company</div>
        <h1 className="mt-2 text-2xl font-bold">Careers</h1>
        <p className="mt-3 text-sm text-slate-700">
          We’re early-stage. Our focus is building a reliable trust + payments + logistics layer for Ghana.
        </p>
        <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
          Interested? Email your CV/portfolio to{' '}
          <a className="text-emerald-700 underline" href="mailto:careers@locallink.local">
            careers@locallink.local
          </a>
          .
        </div>
      </Card>
    </div>
  )
}


