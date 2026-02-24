import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { FARMER_FLORIST_MARKETPLACE_LABEL, roleHomePath } from '../lib/roles.js'
import { http } from '../api/http.js'
import { Button } from '../components/ui/FormControls.jsx'
import { UseCaseTile } from '../components/home/UseCaseTile.jsx'
import { ComingSoonModal } from '../components/home/ComingSoonModal.jsx'
import { ProductCard } from '../components/marketplace/ProductCard.jsx'
import { ServiceCard } from '../components/marketplace/ServiceCard.jsx'
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

function moneyRange(j) {
  const min = j?.pay_min != null ? Number(j.pay_min) : null
  const max = j?.pay_max != null ? Number(j.pay_max) : null
  const c = j?.currency || 'GHS'
  const per = String(j?.pay_period || '').trim().toLowerCase()
  const suffix = per ? ` / ${per}` : ''
  if (min == null && max == null) return null
  if (min != null && max != null) return `${c} ${min.toFixed(0)}–${max.toFixed(0)}${suffix}`
  if (min != null) return `${c} ${min.toFixed(0)}+${suffix}`
  return `${c} up to ${max.toFixed(0)}${suffix}`
}

export function Home() {
  const { isAuthed, user } = useAuth()
  const [features, setFeatures] = useState(null)
  const [comingOpen, setComingOpen] = useState(false)
  const [comingKey, setComingKey] = useState(null)
  const [howItWorksTab, setHowItWorksTab] = useState('buyers')

  const [products, setProducts] = useState([])
  const [services, setServices] = useState([])
  const [jobs, setJobs] = useState([])
  const [carouselsLoading, setCarouselsLoading] = useState(true)

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

  useEffect(() => {
    let cancelled = false
    setCarouselsLoading(true)
    Promise.all([
      http.get('/products').then((r) => (Array.isArray(r.data) ? r.data : r.data?.products ?? [])).catch(() => []),
      http.get('/marketplace/services').then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
      http.get('/corporate/jobs', { params: { limit: 15 } }).then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    ]).then(([prods, svcs, jbs]) => {
      if (!cancelled) {
        setProducts(prods.slice(0, 12))
        setServices(svcs.slice(0, 12))
        setJobs(jbs.slice(0, 12))
      }
    }).finally(() => {
      if (!cancelled) setCarouselsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Events & Domestic are always live on the front page. B2B and Logistics show as "Coming soon" tiles.
  const showEvents = true
  const showDomestic = true
  const showB2B = true
  const showLogistics = true

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

  // Card images: w=1200&h=900 enforces 4:3 aspect (matches aspect-[4/3] containers) for consistent sizing.
  const images = {
    // Coming-soon doors: professional royalty-free photos (direct CDN URLs).
    coming_events: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    coming_domestic: 'https://images.unsplash.com/photo-1626379481874-3dc5678fa8ca?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    coming_b2b: 'https://images.unsplash.com/photo-1606824722920-4c652a70f348?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    coming_logistics: 'https://images.unsplash.com/photo-1665521032636-e8d2f6927053?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',

    // Existing hero door images.
    fix: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    produce: 'https://images.unsplash.com/photo-1646191920445-2534efe74a82?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    project: 'https://images.unsplash.com/photo-1574313428745-ea9221d581ee?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    supply: 'https://images.unsplash.com/photo-1610851467843-fe4a65aea9c0?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    employers: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&h=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
  }

  // Role-fitting default images for job cards (when job has no image_url). Picked by title keywords.
  const jobCardDefaults = {
    retail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70', // store interior
    warehouse: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=240&fit=crop&q=70', // warehouse
    supervisor: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70', // retail store (for Supervisor – Retail Operations)
    office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=240&fit=crop&q=70', // office workspace
    default: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=400&h=240&fit=crop&q=70', // general workplace
  }
  function getDefaultJobImage(job) {
    const t = String((job?.title || '') + ' ' + (job?.employment_type || '')).toLowerCase()
    if (/\b(retail|store|sales|associate|shop)\b/.test(t)) return jobCardDefaults.retail
    if (/\b(warehouse|packer|packing|logistics|inventory)\b/.test(t)) return jobCardDefaults.warehouse
    if (/\b(supervisor|manager|operations|team lead)\b/.test(t)) return jobCardDefaults.supervisor
    if (/\b(office|admin|coordinator)\b/.test(t)) return jobCardDefaults.office
    return jobCardDefaults.default
  }

  if (isAuthed) return <Navigate to={roleHomePath(user?.role)} replace />

  return (
    <div className="space-y-10" data-build="locallink-2026-02-feed-boost">
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

      {/* STATS ROW */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-5 text-center">
          <div className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">2,400+</div>
          <div className="mt-1 text-sm font-medium text-slate-500">Verified providers</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-5 text-center">
          <div className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">GHS 1.2M+</div>
          <div className="mt-1 text-sm font-medium text-slate-500">Paid to artisans</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-5 text-center">
          <div className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">8,000+</div>
          <div className="mt-1 text-sm font-medium text-slate-500">Jobs completed</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-5 text-center">
          <div className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">12 cities</div>
          <div className="mt-1 text-sm font-medium text-slate-500">Across Ghana</div>
        </div>
      </div>

      {/* USE CASES */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
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
            title={`Buy Fresh Produce & Flowers (${FARMER_FLORIST_MARKETPLACE_LABEL} + Delivery)`}
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
                imageUrl={images.coming_domestic}
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
                imageUrl={images.coming_logistics}
                onClick={() => {
                  setComingKey('logistics')
                  setComingOpen(true)
                }}
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

      {/* SLIDING CAROUSELS — browse products, services & jobs like Alibaba/Amazon */}
      <div className="space-y-8">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Provider services</h2>
            <Link to="/marketplace?tab=services" className="text-sm font-semibold text-brand-emerald hover:underline">
              See all →
            </Link>
          </div>
          <div className="relative -mx-2">
            <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory scrollbar-thin" style={{ scrollbarGutter: 'stable' }}>
              {carouselsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-72 h-64 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse snap-start" />
                ))
              ) : services.length === 0 ? (
                <div className="flex-shrink-0 w-full py-8 text-center text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200">
                  No services yet. Artisans add services from their dashboard.
                </div>
              ) : (
                services.map((s) => (
                  <div key={s.id} className="flex-shrink-0 w-72 snap-start">
                    <ServiceCard service={s} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">{FARMER_FLORIST_MARKETPLACE_LABEL}</h2>
            <Link to="/marketplace" className="text-sm font-semibold text-brand-emerald hover:underline">
              See all →
            </Link>
          </div>
          <div className="relative -mx-2">
            <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory" style={{ scrollbarGutter: 'stable' }}>
              {carouselsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-72 h-64 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse snap-start" />
                ))
              ) : products.length === 0 ? (
                <div className="flex-shrink-0 w-full py-8 text-center text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200">
                  No produce listed yet.
                </div>
              ) : (
                products.map((p) => (
                  <div key={p.id} className="flex-shrink-0 w-72 snap-start">
                    <ProductCard product={p} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Employers — open roles</h2>
            <Link to="/jobs" className="text-sm font-semibold text-brand-emerald hover:underline">
              See all →
            </Link>
          </div>
          <div className="relative -mx-2">
            <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory" style={{ scrollbarGutter: 'stable' }}>
              {carouselsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-80 h-40 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse snap-start" />
                ))
              ) : jobs.length === 0 ? (
                <div className="flex-shrink-0 w-full py-8 text-center text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200">
                  No open roles yet. Companies can post jobs from their dashboard.
                </div>
              ) : (
                jobs.map((j) => {
                  const jobImgSrc = j.image_url
                    ? (j.image_url.startsWith('/') ? `${typeof window !== 'undefined' ? window.location.origin : ''}${j.image_url}` : j.image_url)
                    : getDefaultJobImage(j)
                  const jobCardPlaceholder = (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-emerald-200 via-slate-200 to-slate-300">
                      <svg className="h-14 w-14 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-medium text-slate-500">Open role</span>
                    </div>
                  )
                  return (
                  <Link
                    key={j.id}
                    to={`/jobs/${j.id}`}
                    className={['flex-shrink-0 w-80 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-brand-emerald/50 hover:shadow-md', ui.cardHover].join(' ')}
                  >
                    <div className="relative h-36 w-full min-h-[9rem] bg-slate-200">
                      <img
                        src={jobImgSrc}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden') }}
                      />
                      <div className="hidden absolute inset-0">{jobCardPlaceholder}</div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                    </div>
                    <div className="p-4">
                      <div className="font-semibold text-slate-900 line-clamp-1">{j.title}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        {j.company_name || 'Company'}
                        {j.location ? ` · ${j.location}` : ''}
                      </div>
                      {moneyRange(j) ? <div className="mt-2 text-sm font-semibold text-emerald-700">{moneyRange(j)}</div> : null}
                      <div className="mt-3 text-xs font-medium text-brand-emerald">View role →</div>
                    </div>
                  </Link>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <h2 className="text-xl font-bold text-slate-900 md:text-2xl">How it works</h2>
        <p className="mt-2 text-slate-600">
          Every transaction is protected. Nobody pays until the job is done right.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { id: 'buyers', label: 'For Buyers' },
            { id: 'artisans', label: 'For Artisans' },
            { id: 'farmers', label: 'For Farmers' },
            { id: 'drivers', label: 'For Drivers' },
            { id: 'companies', label: 'For Companies' },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setHowItWorksTab(id)}
              className={['rounded-full px-4 py-2 text-sm font-medium transition', howItWorksTab === id ? 'bg-brand-emerald text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
        {(() => {
          const stepsByTab = {
            buyers: [
              { step: '01', title: 'Post your job', body: 'Describe what you need — cleaning, catering, repairs. Add photos, budget, and location in 2 minutes.' },
              { step: '02', title: 'Receive and compare quotes', body: 'Verified local professionals send quotes with price, timeline, and a message. Review profiles and ratings.' },
              { step: '03', title: 'Pay into escrow', body: 'Funds held securely until you\'re satisfied. Your money is never released until the job is done right.' },
              { step: '04', title: 'Release & review', body: 'Happy? Release payment and leave a review. Not satisfied? Open a dispute — we\'ll resolve it fairly.' },
            ],
            artisans: [
              { step: '01', title: 'Create your profile', body: 'Add your skills, services, and rates. Verify with Ghana Card + selfie to earn Bronze, Silver, or Gold — and stand out to buyers.' },
              { step: '02', title: 'Receive quote requests', body: 'Buyers post jobs that match your skills. You send quotes with price, timeline, and a short message.' },
              { step: '03', title: 'Do the job', body: 'Once the buyer accepts and pays into escrow, complete the work. Funds are held safely until the buyer is satisfied.' },
              { step: '04', title: 'Get paid & build reputation', body: 'Buyer releases payment. You get paid and can receive a review that stays on your profile for future jobs.' },
            ],
            farmers: [
              { step: '01', title: 'List your produce or flowers', body: 'Add products with price, unit, and location. Buyers browse the marketplace and order from you.' },
              { step: '02', title: 'Receive orders', body: 'Buyers pay into escrow when they order. You see the order details and can confirm or message the buyer.' },
              { step: '03', title: 'Deliver or arrange pickup', body: 'Deliver to the buyer or agree on pickup. Mark the order delivered so the buyer can confirm.' },
              { step: '04', title: 'Get paid & get reviewed', body: 'Buyer confirms and payment is released to you. Reviews help you attract more buyers next time.' },
            ],
            drivers: [
              { step: '01', title: 'Sign up and go online', body: 'Create your driver profile and set your availability. Buyers and sellers need deliveries across Ghana.' },
              { step: '02', title: 'Accept delivery jobs', body: 'See delivery requests near you — pickup and drop-off. Accept jobs that fit your route and schedule.' },
              { step: '03', title: 'Complete the delivery', body: 'Pick up, transport, and deliver. Update status so the sender and recipient can track.' },
              { step: '04', title: 'Get paid', body: 'Payment is released when the delivery is confirmed. Earn per trip on your own schedule.' },
            ],
            companies: [
              { step: '01', title: 'Create your company', body: 'Add your company profile, logo, and locations. Invite team members and set roles (HR, ops, etc.).' },
              { step: '02', title: 'Post jobs and create shifts', body: 'Publish open roles to the jobs board. Create shifts for casual or recurring work with time and location.' },
              { step: '03', title: 'Track applicants and attendance', body: 'Review applications and shortlist. Use geo check-in and attendance to see who showed up.' },
              { step: '04', title: 'Hire and manage', body: 'Add hires to workforce lists, run payroll (beta), and reduce no-shows with verified workers and data.' },
            ],
          }
          const steps = stepsByTab[howItWorksTab] || []
          if (steps.length === 0) return null
          return (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ step, title, body }) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                  <div className="text-2xl font-bold tabular-nums text-brand-emerald">{step}</div>
                  <div className="mt-2 font-semibold text-slate-900">{title}</div>
                  <p className="mt-2 text-sm text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* TRUST STRIP — enhanced */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className={['rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', ui.cardHover].join(' ')}>
          <div className="text-sm font-semibold text-slate-900">Verified providers, farmers & florists</div>
          <p className="mt-1 text-sm text-slate-600">Bronze / Silver / Gold trust tiers. Ghana Card + selfie verification gives buyers real confidence before hiring.</p>
          <Link to="/trust/verification" className="mt-3 inline-block text-sm font-medium text-brand-emerald hover:underline">Verification tiers →</Link>
        </div>
        <div className={['rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', ui.cardHover].join(' ')}>
          <div className="text-sm font-semibold text-slate-900">Secure escrow payments</div>
          <p className="mt-1 text-sm text-slate-600">Funds held until completion/delivery. Auto-release after 72h. Full dispute resolution if anything goes wrong.</p>
          <span className="mt-3 inline-block text-sm font-medium text-brand-emerald">How escrow works</span>
        </div>
        <div className={['rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', ui.cardHover].join(' ')}>
          <div className="text-sm font-semibold text-slate-900">Real reviews</div>
          <p className="mt-1 text-sm text-slate-600">Reputation that can’t be faked. Every review is tied to a real completed transaction — no anonymous ratings.</p>
          <span className="mt-3 inline-block text-sm font-medium text-brand-emerald">How reviews work</span>
        </div>
        <div className={['rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', ui.cardHover].join(' ')}>
          <div className="text-sm font-semibold text-slate-900">Local support</div>
          <p className="mt-1 text-sm text-slate-600">Help via WhatsApp and phone (coming next). Real humans who understand the Ghanaian market.</p>
          <Link to="/support" className="mt-3 inline-block text-sm font-medium text-brand-emerald hover:underline">Contact us →</Link>
        </div>
      </div>

      {/* EARLY USERS */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <h2 className="text-xl font-bold text-slate-900">Early users</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            { quote: '“I hired a plumber and ordered vegetables in one place. No stress.”', author: 'Early user, Accra' },
            { quote: '“The verification badges make it easy to trust who I\'m paying.”', author: 'SME owner, Kumasi' },
            { quote: '“Escrow is exactly what Ghana needs for work and deliveries.”', author: 'Landlord, Tema' },
          ].map(({ quote, author }, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-amber-500 text-sm tracking-wide">★★★★★</div>
              <div className="mt-3 text-sm text-slate-800">{quote}</div>
              <div className="mt-3 text-xs font-semibold text-slate-600">— {author}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FOR PROVIDERS */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <h2 className="text-2xl font-bold text-slate-900">For providers</h2>
        <p className="mt-2 text-lg font-medium text-slate-700">Your skills. Your hours. Your money.</p>
        <p className="mt-3 text-slate-600">
          Thousands of buyers across Ghana are looking for exactly what you offer. Join as a verified provider and start earning — on your schedule, in your area.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link to="/register?role=artisan" className={['rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition', ui.cardHover].join(' ')}>
            <div className="font-semibold text-slate-900">Artisan / Skilled Professional</div>
            <p className="mt-1 text-sm text-slate-600">Electrician, plumber, cleaner, caterer, builder…</p>
          </Link>
          <Link to="/register?role=farmer" className={['rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition', ui.cardHover].join(' ')}>
            <div className="font-semibold text-slate-900">Farmer / Florist</div>
            <p className="mt-1 text-sm text-slate-600">Sell produce and flowers directly to local buyers</p>
          </Link>
          <Link to="/register?role=driver" className={['rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition', ui.cardHover].join(' ')}>
            <div className="font-semibold text-slate-900">Delivery Driver</div>
            <p className="mt-1 text-sm text-slate-600">Claim deliveries near you, earn per trip</p>
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link to="/register?role=artisan">
            <Button className="px-5 py-2.5">Start earning today</Button>
          </Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm min-w-[280px]">
            <div className="text-xs font-semibold text-slate-500">Your Earnings</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">Dec 2024</div>
            <div className="mt-0.5 text-lg font-semibold text-brand-emerald">GHS 4,820</div>
            <div className="mt-2 text-xs text-slate-500">31% from last month</div>
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-700">
              <li>Deep clean — East Legon · GHS 280</li>
              <li>Electrical repair — Airport Hills · GHS 450</li>
              <li>Catering — Cantonments · GHS 1,200</li>
              <li>Plumbing — Tema · GHS 380</li>
            </ul>
          </div>
        </div>
      </div>

      {/* FOR BUSINESSES */}
      <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm md:p-10">
        <h2 className="text-2xl font-bold text-slate-900">For businesses</h2>
        <p className="mt-2 text-lg font-medium text-slate-700">Run your workforce from one place.</p>
        <p className="mt-3 text-slate-600">
          Post jobs, create shifts, track attendance, and manage your casual and permanent workforce — without the spreadsheets.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Geo-fenced check-in', 'Recurring shifts', 'Workforce lists', 'Post to jobs board', 'Attendance tracking', 'No-show auto-flag'].map((feature) => (
            <span key={feature} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {feature}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/corporate">
            <Button className="px-5 py-2.5">See business features</Button>
          </Link>
          <Link to="/register?role=company">
            <Button variant="secondary" className="px-5 py-2.5">Create company account</Button>
          </Link>
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


