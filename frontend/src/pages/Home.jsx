import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { roleHomePath } from '../lib/roles.js'
import { Button } from '../components/ui/FormControls.jsx'
import { UseCaseTile } from '../components/home/UseCaseTile.jsx'
import { HomeSearchBar } from '../components/home/HomeSearchBar.jsx'
import { HorizontalScroller } from '../components/home/HorizontalScroller.jsx'
import { RailCard } from '../components/home/RailCard.jsx'
import { CategoryChips } from '../components/home/CategoryChips.jsx'

export function Home() {
  const { isAuthed, user } = useAuth()

  if (isAuthed) return <Navigate to={roleHomePath(user?.role)} replace />

  const images = {
    // Royalty-free sources (Unsplash CDN links)
    fix: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    produce:
      'https://images.unsplash.com/photo-1646191920445-2534efe74a82?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    project:
      'https://images.unsplash.com/photo-1574313428745-ea9221d581ee?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    supply:
      'https://images.unsplash.com/photo-1610851467843-fe4a65aea9c0?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    tomatoes:
      'https://images.unsplash.com/photo-1524593166156-312f362cada0?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    tomatoes2:
      'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    plantain:
      'https://images.unsplash.com/photo-1617631716600-6a454b430367?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    plantain2:
      'https://images.unsplash.com/photo-1552709607-08d00227833d?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    plumber:
      'https://images.unsplash.com/photo-1624101910729-b4f4371ff265?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    carpenter:
      'https://images.unsplash.com/photo-1658757740651-977bf745296b?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
  }

  return (
    <div className="space-y-10">
      {/* SEARCH + FILTERS (Airbnb-style, sticky) */}
      <div className="sticky top-0 z-30 -mx-4 bg-slate-50/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60">
        <HomeSearchBar />
        <div className="mt-3">
          <CategoryChips images={images} />
        </div>
      </div>

      {/* HERO */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-soft md:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-brand-emerald/25 via-brand-lime/15 to-brand-orange/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-tr from-brand-orange/20 via-brand-lime/15 to-brand-emerald/20 blur-2xl" />

        <div className="relative max-w-2xl">
          <div className="text-sm font-semibold text-slate-700">
            Trusted local work & supply — Ghana-ready
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-5xl">
            Get trusted local work done. Buy fresh produce safely.
          </h1>
          <p className="mt-5 text-base leading-relaxed text-slate-600">
            Verified artisans and farmers, escrow-style payments (Trust Wallet), real reviews, and local support.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register?role=buyer">
              <Button className="px-5 py-2.5">Get started</Button>
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
            <div className="text-sm font-semibold text-slate-700">Start with an outcome</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              What do you need today?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Use-cases first — so it feels like one platform (not “two apps in one”).
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <UseCaseTile
            title="Fix or Build Something"
            description="Electrician, plumber, mason, carpenter, painter."
            to="/register?role=buyer&intent=fix"
            accent="emerald"
            imageUrl={images.fix}
          />
          <UseCaseTile
            title="Buy Fresh Produce"
            description="Browse photos. Filter by location. Order fast."
            to="/register?role=buyer&intent=produce"
            accent="lime"
            imageUrl={images.produce}
          />
          <UseCaseTile
            title="Run a Project"
            description="Hire multiple artisans + track payments (next)."
            to="/register?role=buyer&intent=project"
            accent="orange"
            imageUrl={images.project}
          />
          <UseCaseTile
            title="Supply My Business"
            description="Weekly farm supply + standing orders (next)."
            to="/register?role=buyer&intent=supply"
            accent="slate"
            imageUrl={images.supply}
          />
        </div>
      </div>

      {/* SLIDE BARS */}
      <div className="space-y-10">
        <HorizontalScroller
          title="Fresh produce offers"
          subtitle="Browse popular bundles — photos, pricing, and locations."
        >
          <RailCard
            to="/register?role=buyer&intent=produce&q=tomatoes&location=Accra"
            imageUrl={images.tomatoes}
            title="Tomatoes bundle"
            subtitle="Accra"
            meta="From GHS 50"
          />
          <RailCard
            to="/register?role=buyer&intent=produce&q=plantain&location=Kumasi"
            imageUrl={images.plantain}
            title="Plantain crate"
            subtitle="Kumasi"
            meta="From GHS 80"
          />
          <RailCard
            to="/register?role=buyer&intent=produce&q=onions&location=Tema"
            imageUrl={images.tomatoes2}
            title="Onions & peppers"
            subtitle="Tema"
            meta="From GHS 65"
          />
          <RailCard
            to="/register?role=buyer&intent=produce&q=vegetables&location=Cape%20Coast"
            imageUrl={images.produce}
            title="Fresh vegetables"
            subtitle="Cape Coast"
            meta="From GHS 60"
          />
          <RailCard
            to="/register?role=buyer&intent=produce&q=plantain&location=Takoradi"
            imageUrl={images.plantain2}
            title="Plantain (bulk)"
            subtitle="Takoradi"
            meta="From GHS 90"
          />
        </HorizontalScroller>

        <HorizontalScroller
          title="Skilled labour near you"
          subtitle="Verified tiers + real reviews (filter after signup)."
        >
          <RailCard
            to="/register?role=buyer&intent=fix&q=electrician&location=Accra"
            imageUrl={images.fix}
            title="Electrician"
            subtitle="Accra • Same-week availability"
            meta="From GHS 120"
          />
          <RailCard
            to="/register?role=buyer&intent=fix&q=plumber&location=Tema"
            imageUrl={images.plumber}
            title="Plumber"
            subtitle="Tema • Emergency callouts"
            meta="From GHS 140"
          />
          <RailCard
            to="/register?role=buyer&intent=fix&q=carpenter&location=Kumasi"
            imageUrl={images.carpenter}
            title="Carpenter"
            subtitle="Kumasi • Doors, cabinets, fittings"
            meta="From GHS 200"
          />
          <RailCard
            to="/register?role=buyer&intent=project&q=project&location=Accra"
            imageUrl={images.project}
            title="Project crew"
            subtitle="Accra • Multiple trades"
            meta="Bundle pricing"
          />
        </HorizontalScroller>
      </div>

      {/* TRUST STRIP */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold">Verified providers & farmers</div>
          <div className="mt-1 text-sm text-slate-600">Bronze / Silver / Gold trust tiers.</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold">Secure escrow payments</div>
          <div className="mt-1 text-sm text-slate-600">Funds held until completion/delivery.</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold">Real reviews</div>
          <div className="mt-1 text-sm text-slate-600">Reputation that can’t be faked.</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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


