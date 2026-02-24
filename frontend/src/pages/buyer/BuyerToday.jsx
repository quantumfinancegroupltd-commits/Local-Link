import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { FIRST_SUCCESS_TEMPLATES } from '../../lib/firstSuccessTemplates.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { UseCaseTile } from '../../components/home/UseCaseTile.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { SocialProofWidget } from '../../components/ui/SocialProofWidget.jsx'
import { SpendSummaryWidget } from '../../components/buyer/SpendSummaryWidget.jsx'
import { JobSuggestionsWidget } from '../../components/buyer/JobSuggestionsWidget.jsx'

export function BuyerToday() {
  const [params] = useSearchParams()
  const focus = params.get('usecase')
  const [counts, setCounts] = useState({ jobs: null, orders: null })
  useBuyerCounts(setCounts)
  const images = {
    // Professional royalty-free photos (direct CDN URLs).
    fix: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    produce: 'https://images.unsplash.com/photo-1646191920445-2534efe74a82?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    project: 'https://images.unsplash.com/photo-1574313428745-ea9221d581ee?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
    supply: 'https://images.unsplash.com/photo-1610851467843-fe4a65aea9c0?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0',
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="What do you need today?"
        subtitle="LocalLink connects work + supply in one place — post jobs, source produce/materials, and manage trust."
        actions={
          <>
            <Link to="/buyer/jobs/new">
              <Button>Post a job</Button>
            </Link>
            <Link to="/buyer/providers">
              <Button variant="secondary">Find providers</Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="secondary">Browse produce</Button>
            </Link>
          </>
        }
      />

      <SocialProofWidget variant="inline" className="mt-1" />

      <SpendSummaryWidget />

      <NeedHelpToday counts={counts} />

      <JobSuggestionsWidget />

      <BuyerFirstSteps counts={counts} />

      <div className="grid gap-4 md:grid-cols-2">
        <UseCaseTile
          title="Fix something"
          description="Post a job, receive quotes, hire with escrow protection (coming next)."
          to="/buyer/jobs/new"
          accent="emerald"
          imageUrl={images.fix}
        />
        <UseCaseTile
          title="Buy fresh produce"
          description="Browse listings with photos, filter by location, and order quickly."
          to="/marketplace"
          accent="lime"
          imageUrl={images.produce}
        />
        <UseCaseTile
          title="Run a project"
          description="Hire trades + source supplies for the same job (materials coming next)."
          to="/buyer?usecase=project"
          accent="orange"
          imageUrl={images.project}
        />
        <UseCaseTile
          title="Supply my business"
          description="Recurring weekly orders & standing service plans (coming next)."
          to="/buyer?usecase=supply"
          accent="slate"
          imageUrl={images.supply}
        />
      </div>

      {(focus === 'project' || focus === 'supply') && (
        <Card className="p-6">
          <div className="text-sm font-semibold">
            {focus === 'project' ? 'Run a project' : 'Supply my business'}
          </div>
          <div className="mt-2 text-sm text-slate-600">
            This is where we’ll add the “ELITE” layer: combined workflows, escrow wallet, verification tiers, and recurring demand.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/buyer/jobs/new">
              <Button>Post a job</Button>
            </Link>
            <Link to="/marketplace">
              <Button variant="secondary">Source produce</Button>
            </Link>
            <Button variant="secondary" disabled title="Coming soon">
              Create standing order
            </Button>
            <Button variant="secondary" disabled title="Coming soon">
              Enable escrow wallet
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

function NeedHelpToday({ counts }) {
  const jobs = Number.isFinite(Number(counts?.jobs)) ? Number(counts.jobs) : null
  const orders = Number.isFinite(Number(counts?.orders)) ? Number(counts.orders) : null
  const ready = jobs != null && orders != null
  const isFirstTime = ready && jobs === 0 && orders === 0
  if (!ready || !isFirstTime) return null

  return (
    <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
      <div className="p-5">
        <h2 className="text-lg font-bold text-slate-900">Need help today?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Post a job in one tap — artisans will send quotes. Add your location and you’re done.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {FIRST_SUCCESS_TEMPLATES.map((t) => (
            <Link key={t.id} to={`/buyer/jobs/new?template=${encodeURIComponent(t.id)}`}>
              <Button variant="secondary" className="shadow-sm">
                {t.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </Card>
  )
}

function BuyerFirstSteps({ counts }) {
  const jobs = Number.isFinite(Number(counts?.jobs)) ? Number(counts.jobs) : null
  const orders = Number.isFinite(Number(counts?.orders)) ? Number(counts.orders) : null
  const ready = jobs != null && orders != null
  const isFirstTime = ready && jobs === 0 && orders === 0
  const noJobs = ready && jobs === 0

  if (!ready) return null
  if (!noJobs && !isFirstTime) return null

  const title = noJobs ? 'No jobs yet' : 'Start here: complete your first transaction'
  const description = noJobs
    ? 'Post your first job to receive quotes from trusted artisans. Once you post, LocalLink becomes much more useful.'
    : 'Browse providers first to find trusted artisans, or post a job to receive quotes. Place a produce order or hire for a fix—once you do, LocalLink becomes much more useful (trust + history).'

  return (
    <NextStepBanner
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link to="/buyer/jobs/new">
            <Button>Post your first job</Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="secondary">Browse produce</Button>
          </Link>
          <Link
            to={`/support?category=${encodeURIComponent('general')}&subject=${encodeURIComponent(
              'First transaction concierge',
            )}&description=${encodeURIComponent(
              'Hi LocalLink team — I’m new. Please help me complete my first transaction (job or produce order).',
            )}&related_type=${encodeURIComponent('concierge')}&related_id=${encodeURIComponent('first_transaction')}`}
          >
            <Button variant="secondary">Need help? (Concierge)</Button>
          </Link>
        </div>
      }
    />
  )
}

// Load counts in the background so we can show "first steps" guidance.
// Kept outside of main component render to avoid clutter.
function useBuyerCounts(setCounts) {
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [jobsRes, ordersRes] = await Promise.all([http.get('/jobs'), http.get('/orders')])
        const jobs = Array.isArray(jobsRes.data) ? jobsRes.data.length : Array.isArray(jobsRes.data?.jobs) ? jobsRes.data.jobs.length : 0
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data.length : Array.isArray(ordersRes.data?.orders) ? ordersRes.data.orders.length : 0
        if (!cancelled) setCounts({ jobs, orders })
      } catch {
        // Best-effort; don't show banner if we can't confidently detect "first time".
        if (!cancelled) setCounts({ jobs: null, orders: null })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [setCounts])
}


