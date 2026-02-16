import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { roleHomePath } from '../lib/roles.js'
import { http } from '../api/http.js'
import { Button } from '../components/ui/FormControls.jsx'
import { UseCaseTile } from '../components/home/UseCaseTile.jsx'
import { ComingSoonModal } from '../components/home/ComingSoonModal.jsx'
import { ui } from '../components/ui/tokens.js'

function ComingSoonTile({ title, description, imageUrl, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={['overflow-hidden rounded-3xl text-left', ui.card, ui.cardHover].join(' ')}
      title="Click for details"
    >
      <div className="relative aspect-[4/3] w-full bg-slate-100">
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/5 to-white/70" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-200/70 via-slate-100/60 to-white" />
        )}
        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 backdrop-blur">
          Coming soon
        </div>
      </div>
      <div className="p-5">
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-sm text-slate-600">{description}</div>
      </div>
    </button>
  )
}

export function Home() {
  const { isAuthed, user } = useAuth()
  const [features, setFeatures] = useState(null)
  const [comingOpen, setComingOpen] = useState(false)
  const [comingKey, setComingKey] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await http.get('/features')
        if (cancelled) return
        setFeatures(res.data?.features ?? {})
      } catch {
        if (!cancelled) setFeatures({})
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Events & Domestic are always live on the front page (repo ready for deploy).
  const showEvents = true
  const showDomestic = true
  const showB2B = !!features?.vertical_b2b_supply
  const showLogistics = !!features?.vertical_logistics

  const comingSoonItems = useMemo(
    () => ({
      events: {
        title: 'Events & Catering',
        subtitle: 'Caterers, chairs/tents, staff — scheduling + escrow.',
        what: [
          'Event job posting + quotes (like Skilled Labour)',
          'Date/time scheduling + deposits',
          'Verified vendors + verified reviews',
          'Escrow holds until completion (or fair dispute resolution)',
        ],
        why: 'Events are high-risk and high-value — escrow + verification removes the “pay and pray” problem.',
        now: ['Hire a Professional for event setup needs', 'Buy Produce for event ingredients', 'Use Support if anything goes wrong'],
      },
      domestic: {
        title: 'Domestic & Recurring',
        subtitle: 'Cleaners, laundry — trust-first repeat services. Care givers coming later.',
        what: ['Recurring bookings (weekly/monthly)', 'Preferred provider re-book', 'Trust + reliability enforcement', 'Dispute/evidence flow', 'Care givers in a future update'],
        why: 'Recurring services need reliability, not just matching — trust signals + repeat workflows make this sticky.',
        now: ['Post a cleaning or laundry need (Hire a Professional)', 'Use Public Profiles to vet providers', 'Care givers will be added in a later release'],
      },
      b2b: {
        title: 'Business Sourcing',
        subtitle: 'Chop bars & SMEs sourcing ingredients reliably (B2B).',
        what: ['Bulk pricing tiers', 'Supplier “storefront” + reliability', 'Delivery coordination + escrow', 'Verified reviews tied to orders'],
        why: 'B2B needs predictable fulfilment — the same trust + ops layer, tuned for repeat purchasing.',
        now: ['Buy Produce via Marketplace', 'Track deliveries and confirm to release escrow'],
      },
      logistics: {
        title: 'Logistics-as-a-Service',
        subtitle: 'Same-day deliveries for shops, pharmacies, hardware.',
        what: ['Create delivery requests (pickup → dropoff)', 'Driver matching + radius/online filters', 'Status-first tracking + ETA ranges'],
        why: 'Logistics wins on clarity and reliability — phase 1 is status-based tracking, not overpromised GPS.',
        now: ['Use delivery inside Marketplace orders', 'Track deliveries in Buyer Orders'],
      },
    }),
    [],
  )

  const images = {
    // Coming-soon doors: professional royalty-free photos (direct CDN URLs).
    // We intentionally avoid source.unsplash.com because it can be blocked by some browsers/networks.
    coming_events: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    coming_domestic: 'https://images.unsplash.com/photo-1626379481874-3dc5678fa8ca?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    coming_b2b: 'https://images.unsplash.com/photo-1606824722920-4c652a70f348?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    coming_logistics: 'https://images.unsplash.com/photo-1665521032636-e8d2f6927053?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',

    // Existing hero door images (can be swapped later if you want all-local assets).
    fix: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    produce: 'https://images.unsplash.com/photo-1646191920445-2534efe74a82?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    project: 'https://images.unsplash.com/photo-1574313428745-ea9221d581ee?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    supply: 'https://images.unsplash.com/photo-1610851467843-fe4a65aea9c0?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    employers: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
  }

  if (isAuthed) return <Navigate to={roleHomePath(user?.role)} replace />

  return (
    <div className="space-y-10" data-build="locallink-2025-02-events-domestic-live">
      <ComingSoonModal open={comingOpen} onClose={() => setComingOpen(false)} item={comingKey ? comingSoonItems[comingKey] : null} />
      {/* HERO */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-soft md:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-brand-emerald/25 via-brand-lime/15 to-brand-orange/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-brand-orange/20 via-brand-lime/15 to-brand-emerald/20 blur-2xl" />

        <div className="relative max-w-2xl">
          <div className="text-sm font-semibold text-slate-700">Trusted local services & supplies — Ghana-ready</div>
          <h1 className="mt-4 text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-5xl">
            Hire a professional. Buy fresh produce. Find employees.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-600">
            LocalLink is a trust + payment + coordination layer: verification tiers, escrow-style payments (Trust Wallet), delivery,
            and real reviews.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register?role=buyer&intent=fix">
              <Button className="px-5 py-2.5">Hire a professional</Button>
            </Link>
            <Link to="/register?role=buyer&intent=produce">
              <Button variant="secondary" className="px-5 py-2.5">
                Buy fresh produce
              </Button>
            </Link>
            <Link to="/corporate">
              <Button variant="secondary" className="px-5 py-2.5">
                For employers
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" className="px-5 py-2.5">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* USE CASES */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold text-slate-700">Launch focus</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Hire, buy, employ — plus events & domestic.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Skilled labour, produce & flowers, and employers. Events & Catering and Domestic (cleaners, laundry) are live with scheduling and escrow. More verticals unlock later.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <UseCaseTile
            title="Hire a Professional (Skilled Labour)"
            description="Plumber, electrician, carpenter, mason, AC servicing."
            to="/register?role=buyer&intent=fix"
            accent="emerald"
            imageUrl={images.fix}
          />
          <UseCaseTile
            title="Buy Fresh Produce & Flowers (Farmers & Florists + Delivery)"
            description="Browse listings, order, and track delivery — with escrow protection."
            to="/register?role=buyer&intent=produce"
            accent="lime"
            imageUrl={images.produce}
          />
          <UseCaseTile
            title="Employers (Post jobs)"
            description="Post roles, track applicants, and reduce no-shows."
            to="/corporate"
            accent="orange"
            imageUrl={images.employers}
          />
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-slate-900">Events, domestic services & more</div>
          <div className="mt-1 text-xs text-slate-500">Caterers and equipment, cleaners and laundry — scheduling + escrow. Care givers coming later.</div>
          <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {showEvents ? (
              <UseCaseTile
                title="Events & Catering"
                description="Caterers, chairs/tents, staff — scheduling + escrow."
                to="/register?role=artisan&category=Events%20%26%20Catering"
                accent="orange"
                imageUrl={images.project}
              />
            ) : (
              <ComingSoonTile
                title="Events & Catering"
                description="Caterers, chairs/tents, staff — scheduling + escrow."
                imageUrl={images.coming_events}
                onClick={() => {
                  setComingKey('events')
                  setComingOpen(true)
                }}
              />
            )}

            {showDomestic ? (
              <UseCaseTile
                title="Domestic & Recurring"
                description="Cleaners, laundry — trust-first, repeat. Care givers coming later."
                to="/register?role=artisan&category=Domestic%20Services"
                accent="slate"
                imageUrl={images.fix}
              />
            ) : (
              <ComingSoonTile
                title="Domestic & Recurring"
                description="Cleaners, laundry — trust-first, repeat. Care givers coming later."
                imageUrl={images.coming_domestic}
                onClick={() => {
                  setComingKey('domestic')
                  setComingOpen(true)
                }}
              />
            )}

            {showB2B ? (
              <UseCaseTile
                title="Business Sourcing"
                description="Chop bars & SMEs sourcing ingredients reliably (B2B)."
                to="/register?role=buyer&intent=produce"
                accent="lime"
                imageUrl={images.supply}
              />
            ) : (
              <ComingSoonTile
                title="Business Sourcing"
                description="Chop bars & SMEs sourcing ingredients reliably (B2B)."
                imageUrl={images.coming_b2b}
                onClick={() => {
                  setComingKey('b2b')
                  setComingOpen(true)
                }}
              />
            )}

            {showLogistics ? (
              <ComingSoonTile
                title="Logistics-as-a-Service"
                description="Enabled, but UI flow isn’t shipped yet (delivery requests coming next)."
              />
            ) : (
              <ComingSoonTile
                title="Logistics-as-a-Service"
                description="Same-day deliveries for shops, pharmacies, hardware."
                imageUrl={images.coming_logistics}
                onClick={() => {
                  setComingKey('logistics')
                  setComingOpen(true)
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* SLIDE BARS */}
      {/* (Intentionally keeping launch page focused; no broad discovery UI here.) */}

      {/* TRUST STRIP */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className={['rounded-3xl p-5', ui.card].join(' ')}>
          <div className="text-sm font-semibold">Verified providers, farmers & florists</div>
          <div className="mt-1 text-sm text-slate-600">Bronze / Silver / Gold trust tiers.</div>
        </div>
        <div className={['rounded-3xl p-5', ui.card].join(' ')}>
          <div className="text-sm font-semibold">Secure escrow payments</div>
          <div className="mt-1 text-sm text-slate-600">Funds held until completion/delivery.</div>
        </div>
        <div className={['rounded-3xl p-5', ui.card].join(' ')}>
          <div className="text-sm font-semibold">Real reviews</div>
          <div className="mt-1 text-sm text-slate-600">Reputation that can’t be faked.</div>
        </div>
        <div className={['rounded-3xl p-5', ui.card].join(' ')}>
          <div className="text-sm font-semibold">Local support</div>
          <div className="mt-1 text-sm text-slate-600">Help via WhatsApp / phone (next).</div>
        </div>
      </div>

      {/* SOCIAL PROOF */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <div className="text-sm font-semibold text-slate-900">Early users</div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm text-slate-800">
              “I hired a plumber and ordered vegetables in one place. No stress.”
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-600">— Early user, Accra</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm text-slate-800">
              “The verification badges make it easy to trust who I’m paying.”
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-600">— SME owner, Kumasi</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-sm text-slate-800">
              “Escrow is exactly what Ghana needs for work and deliveries.”
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-600">— Landlord, Tema</div>
          </div>
        </div>
      </div>

      {/* OFFLINE FIRST */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold text-slate-900">Offline-first</div>
            <div className="mt-2 text-base text-slate-600">
              No smartphone? No problem. Post jobs or orders via WhatsApp or call us (coming next).
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" disabled title="Coming soon">
              WhatsApp us
            </Button>
            <Button variant="secondary" disabled title="Coming soon">
              Call support
            </Button>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Coming next: real wallet balances, escrow transactions, subscriptions, and offline channels (WhatsApp/SMS).
      </div>
    </div>
  )
}


