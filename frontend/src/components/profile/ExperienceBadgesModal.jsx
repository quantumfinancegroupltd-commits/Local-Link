import { useEffect } from 'react'
import { Button, Card } from '../ui/FormControls.jsx'

function toneDot(tone) {
  const t = String(tone || 'slate')
  if (t === 'emerald') return 'bg-emerald-500'
  if (t === 'blue') return 'bg-blue-500'
  return 'bg-slate-400'
}

export function ExperienceBadgesModal({ open, onClose, badges, computedAt, title = 'Badges', initialKey = null }) {
  const items = Array.isArray(badges) ? badges.filter((b) => b?.title) : []

  useEffect(() => {
    if (!open) return
    if (!initialKey) return
    // Give layout a tick, then scroll to badge row
    const t = setTimeout(() => {
      const el = document.getElementById(`badge-${initialKey}`)
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 50)
    return () => clearTimeout(t)
  }, [open, initialKey])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close badges modal" />
      <div className="absolute left-1/2 top-1/2 w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2">
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              {computedAt ? <div className="mt-0.5 text-xs text-slate-500">Updated: {new Date(computedAt).toLocaleString()}</div> : null}
            </div>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>

          <div className="px-5 py-4">
            {items.length === 0 ? (
              <div className="text-sm text-slate-600">No badges yet.</div>
            ) : (
              <div className="space-y-2">
                {items.map((b) => (
                  <div
                    key={b.key || b.title}
                    id={b?.key ? `badge-${b.key}` : undefined}
                    className={[
                      'rounded-2xl border bg-white p-3',
                      initialKey && b?.key && String(b.key) === String(initialKey) ? 'border-emerald-300 ring-2 ring-emerald-100' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start gap-3">
                      <span className={['mt-1 h-2.5 w-2.5 rounded-full', toneDot(b.tone)].join(' ')} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">{b.title}</div>
                        {b?.why ? <div className="mt-1 text-sm text-slate-700">{String(b.why)}</div> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded-2xl border bg-slate-50 p-3 text-xs text-slate-600">
              Badges are earned automatically from verified activity (completed jobs/orders/deliveries, verification, reliability, and endorsements).
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

