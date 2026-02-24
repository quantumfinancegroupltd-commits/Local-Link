import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/feed', label: 'Home', icon: 'home' },
  { to: '/feed?tab=trending', label: 'Trending', icon: 'trending' },
  { to: '/people', label: 'My Network', icon: 'people' },
  { to: '/jobs', label: 'Jobs & Offers', icon: 'briefcase' },
  { to: '/marketplace', label: 'Marketplace', icon: 'marketplace' },
  { to: '/messages', label: 'Messages', icon: 'messages' },
]

function NavIcon({ icon }) {
  const className = 'h-5 w-5 shrink-0'
  switch (icon) {
    case 'home':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 10.5l9-7 9 7V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      )
    case 'trending':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M23 6l-9.5 9.5-5-5L1 18" />
        </svg>
      )
    case 'people':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'briefcase':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      )
    case 'marketplace':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      )
    case 'messages':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )
    default:
      return null
  }
}

export function FeedSidebarLeft({ className = '' }) {
  return (
    <aside className={`shrink-0 ${className}`}>
      <nav className="sticky top-24 space-y-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
              }`
            }
          >
            <NavIcon icon={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
