import { Link } from 'react-router-dom'
import { Button, Card } from '../ui/FormControls.jsx'

function Content({ item }) {
  if (!item) return null

  return (
    <div className="space-y-3 text-sm text-slate-700">
      <div className="text-sm font-semibold text-slate-700">Coming soon</div>
      <div className="text-xl font-bold text-slate-900">{item.title}</div>
      {item.subtitle ? <div className="text-sm text-slate-700">{item.subtitle}</div> : null}

      {item.what ? (
        <div className="rounded-xl border bg-slate-50 p-3">
          <div className="font-semibold text-slate-900">What it will include</div>
          <ul className="mt-2 list-disc pl-5">
            {item.what.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {item.why ? (
        <div className="rounded-xl border bg-white p-3">
          <div className="font-semibold text-slate-900">Why it matters</div>
          <div className="mt-1">{item.why}</div>
        </div>
      ) : null}

      {item.now ? (
        <div className="rounded-xl border bg-white p-3">
          <div className="font-semibold text-slate-900">What you can do today</div>
          <ul className="mt-2 list-disc pl-5">
            {item.now.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function ComingSoonModal({ open, onClose, item }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2">
        <Card className="p-5">
          <Content item={item} />
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Link to="/register?role=buyer">
              <Button>Get started</Button>
            </Link>
            <Link to="/contact">
              <Button variant="secondary">Contact us</Button>
            </Link>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}


