import { Card } from './FormControls.jsx'

export function NextStepBanner({ title = 'Next step', description, actions, variant = 'info', className = '' }) {
  const styles =
    variant === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : variant === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : variant === 'danger'
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-slate-50'

  return (
    <Card className={['p-4', styles, className].join(' ')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {description ? <div className="mt-1 text-sm text-slate-700">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </Card>
  )
}


