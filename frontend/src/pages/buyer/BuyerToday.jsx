import { Link, useSearchParams } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { UseCaseTile } from '../../components/home/UseCaseTile.jsx'

export function BuyerToday() {
  const [params] = useSearchParams()
  const focus = params.get('usecase')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">What do you need today?</h1>
          <p className="text-sm text-slate-600">
            LocalLink connects work + supply in one place — post jobs, source produce/materials, and manage trust.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/buyer/jobs/new">
            <Button>Post a job</Button>
          </Link>
          <Link to="/buyer/providers">
            <Button variant="secondary">Find providers</Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="secondary">Browse produce</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <UseCaseTile
          title="Fix something"
          description="Post a job, receive quotes, hire with escrow protection (coming next)."
          to="/buyer/jobs/new"
          accent="emerald"
        />
        <UseCaseTile
          title="Buy fresh produce"
          description="Browse listings with photos, filter by location, and order quickly."
          to="/marketplace"
          accent="lime"
        />
        <UseCaseTile
          title="Run a project"
          description="Hire trades + source supplies for the same job (materials coming next)."
          to="/buyer?usecase=project"
          accent="orange"
        />
        <UseCaseTile
          title="Supply my business"
          description="Recurring weekly orders & standing service plans (coming next)."
          to="/buyer?usecase=supply"
          accent="slate"
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


