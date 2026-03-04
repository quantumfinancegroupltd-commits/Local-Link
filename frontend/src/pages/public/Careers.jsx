import { Card } from '../../components/ui/FormControls.jsx'

export function Careers() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-400">Company</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Careers</h1>
        <p className="mt-3 text-sm text-slate-700 dark:text-slate-400">
          We’re early-stage. Our focus is building a reliable trust + payments + logistics layer for Ghana.
        </p>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
          Interested? Email your CV/portfolio to{' '}
          <a className="text-emerald-700 underline dark:text-emerald-400" href="mailto:careers@locallink.local">
            careers@locallink.local
          </a>
          .
        </div>
      </Card>
    </div>
  )
}


