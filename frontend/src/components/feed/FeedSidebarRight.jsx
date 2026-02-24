import { Link } from 'react-router-dom'
import { Card } from '../ui/FormControls.jsx'

const TRENDING_PLACEHOLDER = [
  { label: 'Rainy Season Tips', slug: 'rainy-season' },
  { label: 'New Jobs in Kumasi', slug: 'kumasi-jobs' },
  { label: 'How Escrow Works', slug: 'escrow' },
]

export function FeedSidebarRight({ suggestedSection, className = '' }) {
  return (
    <aside className={`shrink-0 ${className}`}>
      <div className="sticky top-24 space-y-4">
        {suggestedSection}

        <Card className="overflow-hidden rounded-2xl border-slate-200 p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Trending now</div>
          <ul className="mt-3 space-y-2">
            {TRENDING_PLACEHOLDER.map((t) => (
              <li key={t.slug}>
                <Link
                  to={`/feed?topic=${encodeURIComponent(t.slug)}`}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/feed?tab=trending" className="mt-2 block text-xs font-medium text-emerald-700 hover:underline">
            See all
          </Link>
        </Card>

        <Card className="overflow-hidden rounded-2xl border-slate-200 p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Local events</div>
          <p className="mt-2 text-xs text-slate-600">Farmers markets, workshops and more — coming soon.</p>
          <Link to="/news" className="mt-2 block text-xs font-medium text-emerald-700 hover:underline">
            News & updates
          </Link>
        </Card>
      </div>
    </aside>
  )
}
