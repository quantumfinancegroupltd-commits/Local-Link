import { Card } from './FormControls.jsx'

export function EmptyState({ title = 'Nothing here yet', description, actions }) {
  return (
    <Card>
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {description ? <div className="mt-2 text-sm text-slate-600">{description}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </Card>
  )
}


