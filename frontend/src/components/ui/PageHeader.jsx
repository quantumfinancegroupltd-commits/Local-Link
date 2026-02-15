import { ui } from './tokens.js'

export function PageHeader({ kicker, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-2xl">
        {kicker ? <div className={ui.kicker}>{kicker}</div> : null}
        <h1 className={['mt-1', ui.h1].join(' ')}>{title}</h1>
        {subtitle ? <p className={['mt-1', ui.sub].join(' ')}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}


