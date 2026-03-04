import { Card } from './FormControls.jsx'
import { ui } from './tokens.js'

export function EmptyState({ title = 'Nothing here yet', description, actions }) {
  return (
    <Card className="py-10 text-center">
      <div className={ui.h2}>{title}</div>
      {description ? <p className="mt-2 mx-auto max-w-md text-sm leading-relaxed text-slate-600">{description}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </Card>
  )
}


