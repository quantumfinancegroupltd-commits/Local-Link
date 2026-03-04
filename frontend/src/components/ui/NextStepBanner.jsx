import { Card } from './FormControls.jsx'

export function NextStepBanner({ title = 'Next step', description, actions, variant = 'info', className = '' }) {
  const styles =
    variant === 'success'
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-900/20'
      : variant === 'warning'
        ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-900/20'
        : variant === 'danger'
          ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-900/20'
          : 'border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5'

  return (
    <Card className={['p-4', styles, className].join(' ')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
          {description ? <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </Card>
  )
}


