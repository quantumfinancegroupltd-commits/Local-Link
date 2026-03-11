import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { roleHomePath } from '../../lib/roles.js'
import { http } from '../../api/http.js'
import { Button } from '../ui/FormControls.jsx'
import { useOnlineStatus } from '../../lib/useOnlineStatus.js'
import { useAnalytics } from '../../lib/useAnalytics.js'
import { useReferralTracking } from '../../lib/referralTracking.js'
import { CookieConsentBanner } from '../CookieConsentBanner.jsx'
import { AssistantFab } from '../assistant/AssistantFab.jsx'
import { ThemeToggle } from '../ui/ThemeToggle.jsx'

function NavItem({ to, children, isActive: isActiveFn }) {
  return (
    <NavLink
      to={to}
      className={({ isActive, location }) => {
        const active = isActiveFn ? isActiveFn({ isActive, location }) : isActive
        return [
          'rounded-lg px-2 py-1.5 text-sm font-medium sm:px-3 sm:py-2',
          active ? 'bg-slate-900 text-white dark:bg-white/10 dark:text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10',
        ].join(' ')
      }}
      isActive={typeof isActiveFn === 'function' ? isActiveFn : undefined}
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
  const [imgError, setImgError] = useState(false)
  useEffect(() => {
    setImgError(false)
  }, [src])
  const showImg = src && !imgError
  if (showImg) {
    return (
      <img
        src={src}
        alt={name ? `${name} avatar` : 'Avatar'}
        className="rounded-full border border-slate-200 object-cover"
        style={{ width: s, height: s }}
        onError={() => setImgError(true)}
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
  const navigate = useNavigate()
  const { isAuthed, user, logout } = useAuth()
  useAnalytics()
  useReferralTracking()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const servicesButtonRef = useRef(null)
  const [servicesMenuPosition, setServicesMenuPosition] = useState({ top: 0, left: 0 })
  const accountButtonRef = useRef(null)
  const [accountMenuPosition, setAccountMenuPosition] = useState({ top: 0, left: 0 })
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ll_recent_searches') || '[]').slice(0, 5) } catch { return [] }
  })
  const searchRef = useRef(null)
  const { online } = useOnlineStatus()

  useLayoutEffect(() => {
    if (!servicesOpen || !servicesButtonRef.current) return
    const update = () => {
      if (!servicesButtonRef.current) return
      const r = servicesButtonRef.current.getBoundingClientRect()
      setServicesMenuPosition({ top: r.bottom + 8, left: r.left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [servicesOpen])

  useLayoutEffect(() => {
    if (!accountOpen || !accountButtonRef.current) return
    const update = () => {
      if (!accountButtonRef.current) return
      const r = accountButtonRef.current.getBoundingClientRect()
      setAccountMenuPosition({ top: r.bottom + 8, right: window.innerWidth - r.right, left: r.left })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [accountOpen])

  const saveRecentSearch = useCallback((q) => {
    const trimmed = String(q ?? '').trim()
    if (!trimmed) return
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5)
      try { localStorage.setItem('ll_recent_searches', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    try { localStorage.removeItem('ll_recent_searches') } catch { /* ignore */ }
  }, [])

  function handleSearchSubmit(e) {
    e.preventDefault()
    const q = String(searchQuery ?? '').trim()
    if (q) {
      saveRecentSearch(q)
      navigate(`/discover?q=${encodeURIComponent(q)}`)
    } else {
      navigate('/discover')
    }
    setSearchFocused(false)
    searchRef.current?.blur()
  }

  const QUICK_SUGGESTIONS = ['Plumber', 'Electrician', 'Tomatoes', 'Driver', 'Carpenter', 'Hairdresser']
  const showSearchDropdown = searchFocused && !searchQuery.trim() && (recentSearches.length > 0 || true)

  const commonLinks = useMemo(
    () => [
      { to: '/feed', label: 'Feed' },
      { to: '/people', label: 'People' },
      { to: '/news', label: 'News' },
      { to: '/ai-assistant', label: 'AI Assistant' },
    ],
    [],
  )
  const navLinks = useMemo(() => {
    if (!isAuthed) return []
    if (user?.role === 'buyer') {
      return [
        { to: '/buyer', label: 'Today' },
        { to: '/buyer/jobs', label: 'Jobs' },
        { to: '/buyer/history', label: 'History' },
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
    const servicesActive = (ctx) => {
      const loc = ctx?.location
      return loc ? loc.pathname === '/services' : false
    }
    const marketplaceActive = (ctx) => {
      const loc = ctx?.location
      return loc ? loc.pathname === '/marketplace' : false
    }
    return [
      { to: '/services', label: 'Services', isActive: servicesActive },
      { to: '/marketplace', label: 'Marketplace', isActive: marketplaceActive },
      { to: '/jobs', label: 'Employers' },
    ]
  }, [])

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

  const location = useLocation()
  const isFeedPage = location.pathname === '/feed'
  const isEconomistReader = /^\/economist\/[^/]+$/.test(location.pathname || '')

  return (
    <div className={`w-full max-w-full min-w-0 flex flex-col overflow-x-hidden ${isFeedPage ? 'h-screen overflow-y-hidden' : 'min-h-screen'}`}>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[9999] focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg">
        Skip to main content
      </a>
      {/* Header can scroll horizontally when nav is long so user block (name + logout) stays visible */}
      <header className="w-full min-w-0 shrink-0 overflow-x-auto overflow-y-hidden border-b bg-white dark:border-white/10 dark:bg-black [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="banner">
        <div className="flex items-center py-3 pl-3 pr-2 sm:py-4 sm:pl-4 sm:pr-3" style={{ minWidth: 'max-content' }}>
          {/* Left: logo + nav */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white md:h-12 md:w-12 dark:bg-white/10">
              <img
                src="/locallink-logo.png"
                alt="LocalLink"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <div className="text-base font-semibold text-slate-900 dark:text-white">LocalLink</div>
              <div className="hidden whitespace-nowrap text-slate-500 lg:block lg:text-[11px] xl:text-xs dark:text-slate-400">
                Trusted local services & supplies — delivered safely
              </div>
            </div>
          </Link>

          <nav className="hidden min-w-0 flex-1 md:flex">
            <div className="flex shrink-0 items-center justify-center gap-2">
            {!isAuthed ? (
              <>
                {servicesLinks.map((l) => (
                  <NavItem key={l.to} to={l.to} isActive={l.isActive}>
                    {l.label}
                  </NavItem>
                ))}
                <NavItem to="/news">News</NavItem>
                <NavItem to="/ai-assistant">AI Assistant</NavItem>
                <NavItem to="/login">Login</NavItem>
              </>
            ) : (
              <>
                <NavItem to={desktopLinks[0]?.to ?? '/'}>{desktopLinks[0]?.label ?? 'Home'}</NavItem>

                <div className="relative">
                  <button
                    ref={servicesButtonRef}
                    type="button"
                    onClick={() => setServicesOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-haspopup="menu"
                    aria-expanded={servicesOpen ? 'true' : 'false'}
                  >
                    Services
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {servicesOpen && createPortal(
                    <>
                      <button
                        className="fixed inset-0 z-[9998] cursor-default"
                        onClick={() => setServicesOpen(false)}
                        aria-label="Close services menu"
                      />
                      <div
                        className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-black/95"
                        style={{ top: servicesMenuPosition.top, left: servicesMenuPosition.left }}
                      >
                        {servicesLinks.map((l) => (
                          <NavLink
                            key={l.to}
                            to={l.to}
                            isActive={l.isActive}
                            className={({ isActive }) => `block px-4 py-3 text-sm font-medium ${isActive ? 'bg-slate-100 text-slate-900 dark:text-white' : 'text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/10'}`}
                            onClick={() => setServicesOpen(false)}
                          >
                            {l.label}
                          </NavLink>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
                </div>

                {desktopLinks.slice(1).filter((l) => !servicesLinks.some((s) => s.to === l.to)).map((l) => (
                  <NavItem key={l.to} to={l.to}>
                    {l.label}
                  </NavItem>
                ))}
              </>
            )}
            </div>
          </nav>
          </div>

          {/* Right: search, theme, notifications, account — always visible, never pushed off */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-l border-slate-200/50 bg-white pl-3 pr-3 dark:border-white/10 dark:bg-black sm:gap-3 sm:pl-4 sm:pr-4">
            <div className="relative hidden min-w-0 xl:block xl:min-w-[7rem] xl:max-w-[14rem]">
              <form onSubmit={handleSearchSubmit} className="block min-w-0">
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                  className="min-w-0 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-white/20 dark:bg-white/10 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-orange-400 dark:focus:ring-orange-500/50"
                  aria-label="Search"
                />
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </form>
              {showSearchDropdown && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 w-full min-w-0 animate-scale-in overflow-hidden rounded-xl border border-stone-200 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-black/95">
                  {recentSearches.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-slate-400">Recent</span>
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); clearRecentSearches() }} className="text-[11px] text-stone-400 hover:text-stone-600 dark:text-slate-400 dark:hover:text-slate-200">Clear</button>
                      </div>
                      {recentSearches.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); saveRecentSearch(s); navigate(`/discover?q=${encodeURIComponent(s)}`); setSearchFocused(false) }}
                          className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0 text-stone-300 dark:text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                          <span className="min-w-0 truncate">{s}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-slate-400">Quick search</div>
                    <div className="flex min-w-0 flex-wrap gap-1 px-2 py-1">
                      {QUICK_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); saveRecentSearch(s); navigate(`/discover?q=${encodeURIComponent(s)}`); setSearchFocused(false) }}
                          className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-emerald-500/20 dark:hover:border-emerald-500/30 dark:hover:text-emerald-300"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2" aria-label="Account and actions">
            {!isAuthed && (
              <Link to="/onboarding" className="hidden md:block">
                <Button>Get started</Button>
              </Link>
            )}
            <ThemeToggle className="hidden sm:inline-flex" />
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

                <div className="relative hidden md:block overflow-visible">
                  <button
                    ref={accountButtonRef}
                    type="button"
                    onClick={() => setAccountOpen((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                    aria-haspopup="menu"
                    aria-expanded={accountOpen ? 'true' : 'false'}
                  >
                    <Avatar src={user?.profile_pic || null} name={user?.name} size={32} />
                    <span className="max-w-[5rem] truncate sm:max-w-[6rem] md:max-w-[8rem] lg:max-w-[10rem] xl:max-w-[12rem]">{user?.name ?? 'Account'}</span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>

                  {accountOpen && createPortal(
                    <>
                      <button
                        className="fixed inset-0 z-[9998] cursor-default"
                        onClick={() => setAccountOpen(false)}
                        aria-label="Close account menu"
                      />
                      <div
                        className="fixed z-[9999] w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-black/95"
                        style={{ top: accountMenuPosition.top, right: accountMenuPosition.right, left: 'auto' }}
                      >
                        <Link
                          to={roleHomePath(user?.role)}
                          className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                          onClick={() => setAccountOpen(false)}
                        >
                          {user?.role === 'company' ? 'Company dashboard' : 'Dashboard'}
                        </Link>
                        <Link
                          to="/notifications"
                          className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                          onClick={() => setAccountOpen(false)}
                        >
                          Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
                        </Link>
                        {user?.role === 'company' ? (
                          <>
                            <Link
                              to="/company/public"
                              className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                              onClick={() => setAccountOpen(false)}
                            >
                              Public company page
                            </Link>
                            <Link
                              to="/profile"
                              className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                              onClick={() => setAccountOpen(false)}
                            >
                              Owner profile
                            </Link>
                          </>
                        ) : (
                          <Link
                            to="/profile"
                            className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                            onClick={() => setAccountOpen(false)}
                          >
                            Profile
                          </Link>
                        )}
                        <Link
                          to="/support"
                          className="block px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
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
                          className="block w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                        >
                          Logout
                        </button>
                      </div>
                    </>,
                    document.body
                  )}
                </div>

                <button
                  onClick={logout}
                  className="hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10 xl:inline-flex"
                >
                  Logout
                </button>
              </>
            ) : null}

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
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm bg-white shadow-soft dark:bg-black dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                {isAuthed ? <Avatar src={user?.profile_pic || null} name={user?.name} size={36} /> : null}
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{isAuthed ? user?.name ?? 'Account' : 'LocalLink'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{isAuthed ? user?.role : 'Welcome'}</div>
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
              <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Appearance</span>
                <ThemeToggle className="sm:hidden" />
              </div>
              {!isAuthed ? (
                <div className="space-y-2">
                  <div className="space-y-2">
                    <Link to="/discover" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        Search
                      </Button>
                    </Link>
                    <Link to="/services" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        Browse services
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
                    <Link to="/ai-assistant" onClick={() => setMobileOpen(false)} className="block">
                      <Button className="w-full" variant="secondary">
                        AI Assistant
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
                  <Link
                    to="/discover"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Search
                  </Link>
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
                      isActive={l.isActive}
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
                    <>
                      <Link
                        to="/company/public"
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Public company page
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setMobileOpen(false)}
                        className="block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Owner profile
                      </Link>
                    </>
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
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-white dark:hover:bg-white/10"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isFeedPage ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-hidden" role="main">
            <Outlet />
          </main>
        </div>
      ) : (
        <main
          id="main-content"
          className={`mx-auto w-full min-w-0 flex-1 overflow-x-hidden ${isEconomistReader ? 'max-w-[1920px] px-2 py-4' : 'max-w-6xl px-4 py-8'}`}
          role="main"
        >
          <Outlet />
        </main>
      )}

      <footer className="w-full min-w-0 shrink-0 overflow-x-hidden border-t bg-white dark:border-white/10 dark:bg-black" role="contentinfo">
        <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-5">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">LocalLink</div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                The trusted operating system for local work & supply.
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Company</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <Link className="block hover:underline" to="/about">
                  About
                </Link>
                <Link className="block hover:underline" to="/contact">
                  Contact
                </Link>
                <Link className="block hover:underline" to="/careers">
                  Careers
                </Link>
                <Link className="block hover:underline" to="/ai-assistant">
                  AI Assistant
                </Link>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Trust</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <Link className="block hover:underline" to="/trust/escrow">
                  How escrow works
                </Link>
                <Link className="block hover:underline" to="/trust/verification">
                  Verification tiers
                </Link>
                <Link className="block hover:underline" to="/trust/reviews">
                  Reviews
                </Link>
                <Link className="block hover:underline" to="/trust/returns">
                  Returns & refunds
                </Link>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Partners</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <Link className="block hover:underline" to="/affiliates">
                  Affiliates
                </Link>
                <Link className="block hover:underline" to="/affiliates#ambassadors">
                  Brand ambassadors
                </Link>
                <Link className="block hover:underline" to="/contact?subject=enterprise">
                  Enterprise partnerships
                </Link>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Get started</div>
              <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <Link className="block hover:underline" to="/register?role=artisan">
                  Become an artisan
                </Link>
                <Link className="block hover:underline" to="/register?role=farmer">
                  Become a farmer or florist
                </Link>
                <Link className="block hover:underline" to="/register?role=buyer&intent=fix">
                  Post a job
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400 dark:border-white/10 dark:text-slate-500" data-footer="copyright">
            LOCALLINK.agency 2026 ©
          </div>
        </div>
      </footer>
      <AssistantFab />
      <CookieConsentBanner />
    </div>
  )
}


