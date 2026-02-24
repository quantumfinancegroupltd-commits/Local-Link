import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../ui/FormControls.jsx'

const ARTISAN_STEPS = [
  { key: 'photo', label: 'Upload profile photo', to: '/profile', done: (ctx) => !!ctx.user?.profile_pic },
  { key: 'service', label: 'Add a service', to: '/artisan/services', done: (ctx) => (ctx.servicesCount ?? 0) > 0 },
  { key: 'location', label: 'Set your service area', to: '/profile', done: (ctx) => !!String(ctx.profile?.service_area ?? '').trim() },
  { key: 'quote', label: 'Submit your first quote', to: '/artisan', done: (ctx) => (ctx.quotesCount ?? 0) > 0 },
]

const FARMER_STEPS = [
  { key: 'photo', label: 'Upload profile photo', to: '/profile', done: (ctx) => !!ctx.user?.profile_pic },
  { key: 'product', label: 'Add a product', to: '/farmer/products/new', done: (ctx) => (ctx.productsCount ?? 0) > 0 },
  { key: 'location', label: 'Set farm location', to: '/profile', done: (ctx) => !!String(ctx.profile?.farm_location ?? '').trim() || (ctx.profile?.farm_lat != null && ctx.profile?.farm_lng != null) },
]

/**
 * First-success checklist for providers: photo, listing, location, (artisan: first quote).
 * Shows progress bar and links to complete each step.
 */
export function ProviderActivationChecklist({ role, user, profile, servicesCount = 0, productsCount = 0, quotesCount = 0, className = '' }) {
  const steps = role === 'farmer' ? FARMER_STEPS : ARTISAN_STEPS
  const ctx = { user, profile, servicesCount, productsCount, quotesCount }

  const { completed, total, pct, missing } = useMemo(() => {
    const completedList = steps.filter((s) => s.done(ctx))
    const missingList = steps.filter((s) => !s.done(ctx))
    const total = steps.length
    const pct = total > 0 ? Math.round((completedList.length / total) * 100) : 0
    return { completed: completedList, total, pct, missing: missingList }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, user?.profile_pic, profile?.service_area, profile?.farm_location, profile?.farm_lat, profile?.farm_lng, servicesCount, productsCount, quotesCount])

  if (total === 0) return null
  if (completed.length === total) return null

  return (
    <Card className={`border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white ${className}`}>
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile strength</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{pct}%</div>
          </div>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {steps.map((s) => {
            const done = s.done(ctx)
            return (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}
                  aria-hidden
                >
                  {done ? '✓' : ''}
                </span>
                {done ? (
                  <span className="text-slate-600 line-through">{s.label}</span>
                ) : (
                  <Link to={s.to} className="font-medium text-emerald-700 hover:underline">
                    {s.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
        {missing.length > 0 ? (
          <p className="mt-2 text-xs text-slate-600">
            Complete these to get more visibility and bookings.
          </p>
        ) : null}
      </div>
    </Card>
  )
}
