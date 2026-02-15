import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { roleHomePath } from '../../lib/roles.js'
import { http } from '../../api/http.js'
import { Button } from '../ui/FormControls.jsx'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'

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

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const first = parts[0]?.[0] ?? 'U'
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

function Avatar({ src, name, size = 36 }) {
  const s = Number(size)
  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name} avatar` : 'Avatar'}
        className="rounded-full border border-slate-200 object-cover"
        style={{ width: s, height: s }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700"
      style={{ width: s, height: s }}
      aria-label={name ? `${name} avatar` : 'Avatar'}
    >
      {initialsFromName(name)}
    </div>
  )
}

export function AppLayout() {
  const { isAuthed, user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const { online } = useOnlineStatus()

  const commonLinks = useMemo(() => [{ to: '/feed', label: 'Feed' }, { to: '/people', label: 'People' }, { to: '/news', label: 'News' }], [])
  const navLinks = useMemo(() => {
    if (!isAuthed) return []
    if (user?.role === 'buyer') {
      return [
        { to: '/buyer', label: 'Today' },
        { to: '/buyer/jobs', label: 'Jobs' },
        { to: '/buyer/orders', label: 'Orders' },
        { to: '/messages', label: 'Messages' },
      ]
    }
    if (user?.role === 'artisan') return [{ to: '/artisan', label: 'Dashboard' }, { to: '/shifts', label: 'My shifts' }, { to: '/messages', label: 'Messages' }]
    if (user?.role === 'farmer') return [{ to: '/farmer', label: 'My Produce' }, { to: '/shifts', label: 'My shifts' }, { to: '/messages', label: 'Messages' }]
    if (user?.role === 'driver') return [{ to: '/driver', label: 'Deliveries' }, { to: '/shifts', label: 'My shifts' }, { to: '/messages', label: 'Messages' }]
    if (user?.role === 'company') return [{ to: '/company', label: 'Company' }, { to: '/jobs', label: 'Jobs' }]
    if (user?.role === 'admin') return [{ to: '/admin', label: 'Admin' }]
    return []
  }, [isAuthed, user?.role])

  const servicesLinks = useMemo(() => {
    const providersTo = isAuthed && user?.role === 'buyer' ? '/buyer/providers' : '/providers'
    return [
      { to: providersTo, label: 'Providers' },
      { to: '/marketplace', label: 'Marketplace' },
      { to: '/jobs', label: 'Employers' },
    ]
  }, [isAuthed, user?.role])

  const desktopLinks = useMemo(() => {
    if (!isAuthed) return []
    const primary = navLinks[0] ? [navLinks[0]] : []
    const rest = navLinks.slice(1)
    // Today (or role primary) first, then services, then common, then the rest.
    return [...primary, ...servicesLinks, ...commonLinks, ...rest]
  }, [isAuthed, navLinks, servicesLinks, commonLinks])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setAccountOpen(false)
        setServicesOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Lightweight polling for unread notifications badge.
  useEffect(() => {
    let cancelled = false
    async function loadUnread() {
      if (!isAuthed) return
      try {
        const r = await http.get('/notifications?limit=1')
        const c = Number(r.data?.unreadCount ?? 0)
        if (!cancelled) setUnreadNotifications(Number.isFinite(c) ? c : 0)
      } catch {
        // ignore (best-effort)
      }
    }
    if (isAuthed) loadUnread()
    if (!isAuthed) return
    const t = setInterval(loadUnread, 15000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [isAuthed])

  return (
    <div className="min-h-full">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <img
              src="/locallink-logo.png"
              alt="LocalLink"
              className="h-11 w-11 shrink-0 rounded-2xl object-cover md:h-12 md:w-12"
              loading="eager"
            />
            <div className="flex flex-col justify-center min-w-0">
              <div className="text-base font-semibold text-slate-900">LocalLink</div>
              <div className="hidden whitespace-nowrap text-slate-500 lg:block lg:text-xs xl:text-sm">
                Trusted local services & supplies — delivered safely
              </div>
            </div>
          </Link>

          <nav className="hidden flex-wrap items-center justify-end gap-2 md:flex">
            {!isAuthed ? (
              <>
                {servicesLinks.map((l) => (
                  <NavItem key={l.to} to={l.to}>
                    {l.label}
                  </NavItem>
                ))}
                <NavItem to="/news">News</NavItem>
                <NavItem to="/login">Login</NavItem>
              </>
            ) : (
              <>
                <NavItem to={desktopLinks[0]?.to ?? '/'}>{desktopLinks[0]?.label ?? 'Home'}</NavItem>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setServicesOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    aria-haspopup="menu"
                    aria-expanded={servicesOpen ? 'true' : 'false'}
                  >
                    Services
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {servicesOpen ? (
                    <>
                      <button
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setServicesOpen(false)}
                        aria-label="Close services menu"
                      />
                      <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                        {servicesLinks.map((l) => (
                          <NavLink
                            key={l.to}
                            to={l.to}
                            className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                            onClick={() => setServicesOpen(false)}
                          >
                            {l.label}
                          </NavLink>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>

                {desktopLinks.slice(1).filter((l) => !servicesLinks.some((s) => s.to === l.to)).map((l) => (
                  <NavItem key={l.to} to={l.to}>
                    {l.label}
                  </NavItem>
                ))}
              </>
            )}
          </nav>

          <div className="flex flex-shrink-0 items-center gap-2">
            {isAuthed ? (
              <>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 md:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open menu"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                <Link
                  to="/notifications"
                  className="relative hidden md:inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  ) : null}
                </Link>

                <div className="relative hidden md:block">
                  <button
                    type="button"
                    onClick={() => setAccountOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    aria-haspopup="menu"
                    aria-expanded={accountOpen ? 'true' : 'false'}
                  >
                    <Avatar src={user?.profile_pic || null} name={user?.name} size={32} />
                    <span className="max-w-[14rem] truncate">{user?.name ?? 'Account'}</span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {accountOpen ? (
                    <>
                      <button
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setAccountOpen(false)}
                        aria-label="Close account menu"
                      />
                      <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
                        <Link
                          to={roleHomePath(user?.role)}
                          className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                          onClick={() => setAccountOpen(false)}
                        >
                          {user?.role === 'company' ? 'Company dashboard' : 'Dashboard'}
                        </Link>
                        <Link
                          to="/notifications"
                          className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                          onClick={() => setAccountOpen(false)}
                        >
                          Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
                        </Link>
                        {user?.role === 'company' ? (
                          <Link
                            to="/company/public"
                            className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                            onClick={() => setAccountOpen(false)}
                          >
                            Public company page
                          </Link>
                        ) : (
                          <Link
                            to="/profile"
                            className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                            onClick={() => setAccountOpen(false)}
                          >
                            Profile
                          </Link>
                        )}
                        <Link
                          to="/support"
                          className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                          onClick={() => setAccountOpen(false)}
                        >
                          Support
                        </Link>
                        <div className="border-t" />
                        <button
                          onClick={() => {
                            setAccountOpen(false)
                            logout()
                          }}
                          className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                        >
                          Logout
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>

                <button
                  onClick={logout}
                  className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:inline-flex"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/onboarding"
                className="hidden md:block"
              >
                <Button>Get started</Button>
              </Link>
            )}

            {!isAuthed ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {!online ? (
        <div className="border-b bg-amber-50">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs font-semibold text-amber-900">
            <div>You’re offline. Drafts will be saved on this device.</div>
            <div className="text-amber-800">Reconnect to submit.</div>
          </div>
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-white shadow-soft">
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                {isAuthed ? <Avatar src={user?.profile_pic || null} name={user?.name} size={36} /> : null}
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-slate-900">{isAuthed ? user?.name ?? 'Account' : 'LocalLink'}</div>
                  <div className="text-xs text-slate-500">{isAuthed ? user?.role : 'Welcome'}</div>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {!isAuthed ? (
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Link to="/providers" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        Browse providers
                      </Button>
                    </Link>
                    <Link to="/marketplace" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        Browse marketplace
                      </Button>
                    </Link>
                    <Link to="/jobs" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        Browse employment
                      </Button>
                    </Link>
                    <Link to="/news" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        News
                      </Button>
                    </Link>
                  </div>
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="block">
                    <Button className="w-full" variant="secondary">
                      Login
                    </Button>
                  </Link>
                  <Link to="/onboarding" onClick={() => setMobileOpen(false)} className="block">
                    <Button className="w-full">Get started</Button>
                  </Link>
                  <div className="mt-4 border-t pt-4">
                    <Link to="/about" onClick={() => setMobileOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      About
                    </Link>
                    <Link to="/trust/escrow" onClick={() => setMobileOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      How escrow works
                    </Link>
                    <Link to="/contact" onClick={() => setMobileOpen(false)} className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      Contact
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Primary first (e.g. Today) */}
                  {navLinks[0] ? (
                    <NavLink
                      to={navLinks[0].to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        [
                          'block rounded-xl px-3 py-2 text-sm font-semibold',
                          isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                        ].join(' ')
                      }
                    >
                      {navLinks[0].label}
                    </NavLink>
                  ) : null}

                  <div className="my-2 border-t" />
                  <div className="px-3 pt-2 text-xs font-semibold text-slate-500">Services</div>
                  {servicesLinks.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        [
                          'block rounded-xl px-3 py-2 text-sm font-semibold',
                          isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                        ].join(' ')
                      }
                    >
                      {l.label}
                    </NavLink>
                  ))}

                  <div className="my-2 border-t" />
                  {[...commonLinks, ...navLinks.slice(1)].map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        [
                          'block rounded-xl px-3 py-2 text-sm font-semibold',
                          isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                        ].join(' ')
                      }
                    >
                      {l.label}
                    </NavLink>
                  ))}
                  <div className="my-3 border-t" />
                  <Link
                    to="/notifications"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Notifications{unreadNotifications > 0 ? ` (${unreadNotifications > 99 ? '99+' : unreadNotifications})` : ''}
                  </Link>
                  {user?.role === 'company' ? (
                    <Link
                      to="/company/public"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Public company page
                    </Link>
                  ) : (
                    <Link
                      to="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Profile
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false)
                      logout()
                    }}
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
                <Link className="block hover:underline" to="/about">
                  About
                </Link>
                <Link className="block hover:underline" to="/contact">
                  Contact
                </Link>
                <Link className="block hover:underline" to="/careers">
                  Careers
                </Link>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Trust</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <Link className="block hover:underline" to="/trust/escrow">
                  How escrow works
                </Link>
                <Link className="block hover:underline" to="/trust/verification">
                  Verification tiers
                </Link>
                <Link className="block hover:underline" to="/trust/reviews">
                  Reviews
                </Link>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Get started</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600">
                <Link className="block hover:underline" to="/register?role=artisan">
                  Become an artisan
                </Link>
                <Link className="block hover:underline" to="/register?role=farmer">
                  Become a farmer
                </Link>
                <Link className="block hover:underline" to="/register?role=buyer&intent=fix">
                  Post a job
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div>LocalLink MVP — Phase 1</div>
            <div>
              Build:{' '}
              {String(globalThis.__LOCAL_LINK_BUILD_ID__ || '').trim()
                ? String(globalThis.__LOCAL_LINK_BUILD_ID__).slice(0, 12)
                : String(globalThis.__LOCAL_LINK_BUILD_TIME__ || '').replace('T', ' ').replace('Z', ' UTC')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}


