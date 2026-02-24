import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { roleHomePath } from '../../lib/roles.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { usePageMeta } from '../../components/ui/seo.js'
import { openAssistant } from '../../components/assistant/AssistantFab.jsx'

function Icon({ kind }) {
  const k = String(kind || '')
  if (k === 'home') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5l9-7 9 7V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      </div>
    )
  }
  if (k === 'basket') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lime-50 text-lime-700">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 10l6-7 6 7" />
          <path d="M3 10h18l-2 11H5L3 10z" />
        </svg>
      </div>
    )
  }
  if (k === 'building') {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-700">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21h18" />
          <path d="M7 21V3h10v18" />
          <path d="M10 7h4M10 11h4M10 15h4" />
        </svg>
      </div>
    )
  }
  return null
}

function ActionRow({ to, label, variant = 'primary', note }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link to={to}>
        <Button variant={variant}>{label}</Button>
      </Link>
      {note ? <div className="text-xs font-semibold text-slate-500">{note}</div> : null}
    </div>
  )
}

function PathCard({ icon, title, subtitle, bullets, actions = [] }) {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Icon kind={icon} />
        <div className="min-w-0">
          <div className="text-base font-bold text-slate-900">{title}</div>
          <div className="mt-1 text-sm text-slate-600">{subtitle}</div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-[2px] inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              ✓
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2">
        {actions.slice(0, 3).map((a) => (
          <ActionRow key={`${a.to}-${a.label}`} to={a.to} label={a.label} variant={a.variant} note={a.note} />
        ))}
      </div>
    </Card>
  )
}

function TrustPills() {
  const pills = [
    { title: 'Escrow protection', body: 'Money held safely until work is done.' },
    { title: 'Verified-only reviews', body: 'Reviews come from real transactions.' },
    { title: 'Dispute support', body: 'Fair resolution when something goes wrong.' },
    { title: 'Offline-friendly', body: 'Drafts save when your network drops.' },
  ]
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {pills.map((p) => (
        <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{p.title}</div>
          <div className="mt-1 text-sm text-slate-600">{p.body}</div>
        </div>
      ))}
    </div>
  )
}

export function Onboarding() {
  usePageMeta({
    title: 'Get started with LocalLink',
    description: 'Choose what you’re here to do: hire providers, buy/sell produce, or use Employers for jobs and company pages.',
  })

  const { isAuthed, user } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2">
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">Get started with LocalLink</div>
          <div className="text-slate-700">
            Choose what you’re here to do. You can always switch later—LocalLink supports buyers, providers, and companies.
          </div>
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3">
            <p className="text-sm font-medium text-emerald-900">Not sure where to start?</p>
            <p className="mt-0.5 text-sm text-emerald-800">Ask YAO — your LocalLink guide. He can help you choose and explain escrow, jobs, verification, and more.</p>
            <button
              type="button"
              onClick={openAssistant}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Ask YAO
            </button>
          </div>
          {!isAuthed ? (
            <div className="mt-2 text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
                Login
              </Link>
            </div>
          ) : (
            <div className="mt-2">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                You’re signed in as <span className="font-semibold">{user?.name ?? 'Account'}</span>. Continue to your dashboard.
                <div className="mt-3">
                  <Link to={roleHomePath(user?.role)}>
                    <Button>Go to dashboard</Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <PathCard
            icon="home"
            title="Hire a provider (Home & services)"
            subtitle="Post once, get quotes, pay safely."
            bullets={['Find verified artisans nearby', 'Compare quotes and timelines', 'Pay via escrow for protection']}
            actions={[
              { label: 'Post a job', to: '/register?role=buyer&intent=fix', variant: 'primary', note: 'Buyer account' },
              { label: 'Browse providers', to: '/providers', variant: 'secondary' },
              { label: 'I’m a service provider', to: '/register?role=artisan', variant: 'secondary', note: 'Create provider profile' },
            ]}
          />

          <PathCard
            icon="basket"
            title="Buy & sell produce (Marketplace)"
            subtitle="Farmers & florists list produce, buyers order, drivers deliver."
            bullets={['Fresh produce listings', 'Order tracking & delivery options', 'Verified reviews on completed orders']}
            actions={[
              { label: 'Browse produce', to: '/marketplace', variant: 'primary', note: 'Explore listings' },
              { label: 'List produce (farmer / florist)', to: '/register?role=farmer', variant: 'secondary' },
              { label: 'Deliver & earn', to: '/register?role=driver', variant: 'secondary' },
            ]}
          />

          <PathCard
            icon="building"
            title="Employers (Jobs & company pages)"
            subtitle="For employers and job seekers."
            bullets={['Companies create pages and post jobs', 'Workers apply in one place', 'Designed for repeat hiring']}
            actions={[
              { label: 'Browse jobs', to: '/jobs', variant: 'primary' },
              { label: 'Create company account', to: '/register?role=company', variant: 'secondary', note: 'Employers' },
              { label: 'Create a personal account', to: '/register?role=buyer&intent=jobs', variant: 'secondary', note: 'Job seekers' },
            ]}
          />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 md:items-start">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-base font-bold text-slate-900">How it works</div>
            <ol className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex gap-3">
                <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  1
                </span>
                <span>
                  <span className="font-semibold">Choose your path</span> (buyer, provider, or company).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  2
                </span>
                <span>
                  <span className="font-semibold">Complete your profile</span> so others can trust you (photo, bio, verification).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-[2px] inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  3
                </span>
                <span>
                  <span className="font-semibold">Transact safely</span> with escrow + verified-only reviews + support.
                </span>
              </li>
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/trust/escrow">
                <Button variant="secondary">Escrow</Button>
              </Link>
              <Link to="/trust/verification">
                <Button variant="secondary">Verification</Button>
              </Link>
              <Link to="/trust/reviews">
                <Button variant="secondary">Reviews</Button>
              </Link>
            </div>
          </div>

          <TrustPills />
        </div>

        <div className="mt-10">
          <div className="text-sm font-semibold text-slate-900">Want the “why” and examples?</div>
          <div className="mt-1 text-sm text-slate-600">
            See the advert-style highlights page (useful for marketing shares).
          </div>
          <div className="mt-3">
            <Link to="/adverts" className="text-sm font-semibold text-emerald-700 hover:underline">
              View highlights →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

