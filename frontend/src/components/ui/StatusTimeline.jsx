function dotClass(state) {
  if (state === 'done') return 'bg-emerald-600'
  if (state === 'active') return 'bg-orange-500'
  return 'bg-slate-300'
}

function textClass(state) {
  if (state === 'done') return 'text-slate-900'
  if (state === 'active') return 'text-slate-900'
  return 'text-slate-500'
}

function lineClass(state) {
  if (state === 'done') return 'bg-emerald-600'
  if (state === 'active') return 'bg-orange-400'
  return 'bg-slate-200'
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/**
 * StatusTimeline
 * steps: [{ key, title, description?, state: 'done'|'active'|'pending' }]
 * layout: 'vertical' | 'horizontal'
 * progressValue: number 0..1 (optional override)
 * progressLabel: string (optional, e.g. "ETA ~18 min • 12.4 km")
 */
export function StatusTimeline({ steps, layout = 'vertical', compact = false, className = '', progressValue, progressLabel }) {
  const list = Array.isArray(steps) ? steps : []

  const computedProgress = (() => {
    if (Number.isFinite(Number(progressValue))) {
      return Math.max(0, Math.min(1, Number(progressValue)))
    }
    if (!list.length) return 0
    let sum = 0
    for (const s of list) {
      if (s.state === 'done') sum += 1
      else if (s.state === 'active') sum += 0.5
    }
    return Math.max(0, Math.min(1, sum / list.length))
  })()

  if (layout === 'horizontal') {
    return (
      <div className={['w-full', className].join(' ')}>
        <div className="flex items-start gap-2">
          {list.map((s, idx) => {
            const isLast = idx === list.length - 1
            return (
              <div key={s.key ?? idx} className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <div
                    className={[
                      'flex h-6 w-6 items-center justify-center rounded-full text-white',
                      dotClass(s.state),
                    ].join(' ')}
                    aria-hidden="true"
                  >
                    {s.state === 'done' ? <CheckIcon /> : null}
                  </div>
                  {!isLast ? <div className={['h-[2px] flex-1', lineClass(s.state)].join(' ')} /> : <div className="flex-1" />}
                </div>
                <div className={['mt-2 text-xs font-semibold', textClass(s.state)].join(' ')}>{s.title}</div>
                {!compact && s.description ? <div className="mt-1 text-xs text-slate-600">{s.description}</div> : null}
              </div>
            )
          })}
        </div>
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600"
              style={{ width: `${Math.round(computedProgress * 100)}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="mt-2 text-xs text-slate-600">
            {progressLabel ? progressLabel : `Progress: ${Math.round(computedProgress * 100)}%`}
          </div>
        </div>
      </div>
    )
  }

  // vertical
  return (
    <div className={['space-y-4', className].join(' ')}>
      {list.map((s, idx) => {
        const isLast = idx === list.length - 1
        return (
          <div key={s.key ?? idx} className="flex gap-3">
            <div className="relative pt-1">
              <div
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-white',
                  dotClass(s.state),
                ].join(' ')}
                aria-hidden="true"
              >
                {s.state === 'done' ? <CheckIcon /> : null}
              </div>
              {!isLast ? <div className="absolute left-[11px] top-7 h-[calc(100%-24px)] w-[2px] bg-slate-200" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className={['text-sm font-semibold', textClass(s.state)].join(' ')}>{s.title}</div>
              {!compact && s.description ? <div className="mt-1 text-sm text-slate-600">{s.description}</div> : null}
            </div>
          </div>
        )
      })}
      <div className="pt-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${Math.round(computedProgress * 100)}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 text-xs text-slate-600">
          {progressLabel ? progressLabel : `Progress: ${Math.round(computedProgress * 100)}%`}
        </div>
      </div>
    </div>
  )
}


