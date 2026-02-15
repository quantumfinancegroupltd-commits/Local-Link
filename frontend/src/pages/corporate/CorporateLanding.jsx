import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'

export function CorporateLanding() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        kicker="Employers"
        title="Hire reliably. Track applicants. Reduce no-shows."
        subtitle="LocalLink Employers helps companies in Ghana post jobs and manage applications in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/jobs">
              <Button variant="secondary">Browse jobs</Button>
            </Link>
            <Link to="/register?role=company">
              <Button>Post a job</Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm font-semibold">Company profile</div>
          <div className="mt-1 text-sm text-slate-600">Create a public company page and build trust with applicants.</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-semibold">Job posting</div>
          <div className="mt-1 text-sm text-slate-600">Post roles for trades, operations, warehouse, logistics, and office hiring.</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-semibold">Applicant tracking</div>
          <div className="mt-1 text-sm text-slate-600">See applicants, contact fast, and keep a clean shortlist.</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold">For enterprise / industry</div>
        <div className="mt-1 text-sm text-slate-600">
          We’ll introduce shift-based workforce hiring (attendance + reliability) as a separate “Industry Mode” once the corporate pilot is proven.
        </div>
      </Card>
    </div>
  )
}

