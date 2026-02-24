import { Link } from 'react-router-dom'
import { Card } from '../ui/FormControls.jsx'

const TRENDING_PLACEHOLDER = [
  { label: 'Rainy Season Tips', slug: 'rainy-season' },
  { label: 'New Jobs in Kumasi 💡', slug: 'kumasi-jobs' },
  { label: 'How Escrow Works 💡', slug: 'escrow' },
]

const LOCAL_EVENTS = [
  { title: 'Farmers Market on Saturday!', date: 'Apr 17, 10:00 AM', cta: 'Join us', to: '/marketplace', image: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=320&h=120&fit=crop' },
  { title: 'Business Workshop in Accra', date: 'May 3, 2:00 PM', cta: 'Learn more', to: '/news', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=320&h=120&fit=crop' },
]

export function FeedSidebarRight({ className = '' }) {
  return (
    <aside className={`shrink-0 ${className}`}>
      <div className="sticky top-24 space-y-4">
        <Card className="overflow-hidden rounded-2xl border-slate-200 p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Trending now</div>
          <ul className="mt-3 space-y-2">
            {TRENDING_PLACEHOLDER.map((t) => (
              <li key={t.slug}>
                <Link
                  to={`/feed?topic=${encodeURIComponent(t.slug)}`}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span className="text-emerald-500">▶</span>
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
          <div className="mt-3 space-y-3">
            {LOCAL_EVENTS.map((ev) => (
              <Link key={ev.to + ev.title} to={ev.to} className="block overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 transition hover:bg-slate-100/80">
                <img src={ev.image} alt="" className="h-20 w-full object-cover" />
                <div className="p-2.5">
                  <div className="text-xs font-semibold text-slate-900">{ev.title}</div>
                  <div className="text-[11px] text-slate-600">{ev.date}</div>
                  <span className="mt-1 inline-block text-xs font-medium text-emerald-700">{ev.cta}</span>
                </div>
              </Link>
            ))}
          </div>
          <Link to="/news" className="mt-2 block text-xs font-medium text-emerald-700 hover:underline">
            News & updates
          </Link>
        </Card>
      </div>
    </aside>
  )
}
