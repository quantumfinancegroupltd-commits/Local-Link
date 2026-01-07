import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext.jsx'
import { roleHomePath } from '../../lib/roles.js'

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'rounded-lg px-3 py-2 text-sm font-medium',
          isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}

export function AppLayout() {
  const { isAuthed, user, logout } = useAuth()

  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-4">
            <img
              src="/locallink-logo.png"
              alt="LocalLink"
              className="h-14 w-14 rounded-3xl object-cover"
              loading="eager"
            />
            <div className="flex flex-col justify-center leading-tight">
              <div className="text-base font-semibold">LocalLink</div>
              <div className="text-sm text-slate-500">Skilled labor + farmers marketplace</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {!isAuthed && (
              <>
                <NavItem to="/login">Login</NavItem>
                <NavItem to="/register">Register</NavItem>
              </>
            )}

            {isAuthed && user?.role === 'buyer' && (
              <>
                <NavItem to="/buyer">Today</NavItem>
                <NavItem to="/buyer/jobs">Jobs</NavItem>
                <NavItem to="/buyer/providers">Providers</NavItem>
                <NavItem to="/marketplace">Produce</NavItem>
              </>
            )}

            {isAuthed && user?.role === 'artisan' && (
              <>
                <NavItem to="/artisan">Browse Jobs</NavItem>
              </>
            )}

            {isAuthed && user?.role === 'farmer' && (
              <>
                <NavItem to="/farmer">My Produce</NavItem>
              </>
            )}

            {isAuthed && user?.role === 'admin' && (
              <>
                <NavItem to="/admin">Admin</NavItem>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthed ? (
              <>
                <Link
                  to={roleHomePath(user?.role)}
                  className="hidden rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 md:inline-block"
                >
                  {user?.name ?? 'Account'}
                </Link>
                <button
                  onClick={logout}
                  className="rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="rounded-xl bg-gradient-to-r from-brand-emerald via-brand-lime to-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                Get started
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">LocalLink</div>
              <div className="mt-2 text-sm text-slate-600">
                The trusted operating system for local work & supply.
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Company</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <div>About</div>
                <div>Contact</div>
                <div>Careers</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Trust</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <div>How escrow works</div>
                <div>Verification tiers</div>
                <div>Reviews</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Get started</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <div>Become an artisan</div>
                <div>Become a farmer</div>
                <div>Post a job</div>
              </div>
            </div>
          </div>
          <div className="mt-10 text-xs text-slate-500">LocalLink MVP — Phase 1</div>
        </div>
      </footer>
    </div>
  )
}


