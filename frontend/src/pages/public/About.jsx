import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="text-sm font-semibold text-slate-700">Company</div>
        <h1 className="mt-2 text-2xl font-bold">About LocalLink</h1>
        <p className="mt-3 text-sm text-slate-700">
          LocalLink is a trust + payment + coordination layer for local work and supply in Ghana. We help{' '}
          <span className="font-medium">employers</span> post jobs and hire skilled workers at scale;{' '}
          <span className="font-medium">buyers</span> hire professionals and buy fresh produce; and{' '}
          <span className="font-medium">artisans, farmers/florists, and drivers</span> get paid fairly with transparent rules,
          escrow protection, delivery coordination, and real reputation.
        </p>
        <div className="mt-4 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
          Launch focus: <span className="font-semibold">Employers</span> (post jobs, company profiles, verified workers),{' '}
          <span className="font-semibold">Skilled Labour</span>, and <span className="font-semibold">Farm Produce & Florists</span>.
          New verticals unlock later without rebuilding the platform.
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/trust/escrow">
            <Button variant="secondary">How escrow works</Button>
          </Link>
          <Link to="/corporate">
            <Button>For employers</Button>
          </Link>
          <Link to="/register?role=buyer&intent=fix">
            <Button variant="secondary">Hire a professional</Button>
          </Link>
          <Link to="/register?role=buyer&intent=produce">
            <Button variant="secondary">Buy fresh produce</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}


