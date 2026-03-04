/**
 * Layout for browse/listing pages (Jobs, Marketplace, Services) with optional left filter sidebar.
 * Sidebar is sticky; sidebarBottom (e.g. map) is in the same column below the filters.
 * On small screens sidebar can be toggled or shown above content.
 */
import { useState } from 'react'
import { Button } from '../ui/FormControls.jsx'

export function BrowseLayout({ sidebar, sidebarBottom, children, title, subtitle, actions, className = '' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={`mx-auto max-w-[1280px] px-4 py-6 md:px-6 ${className}`}>
      {(title || actions) ? (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left column: filters card (sticky) + optional map card below */}
        {sidebar || sidebarBottom ? (
          <>
            {sidebar && sidebarOpen ? (
              <div className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 lg:hidden space-y-4">
                {sidebar}
                {sidebarBottom}
                <Button variant="secondary" className="mt-3" onClick={() => setSidebarOpen(false)}>
                  Hide filters
                </Button>
              </div>
            ) : sidebar ? (
              <Button
                variant="secondary"
                className="w-fit lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-expanded={false}
              >
                Show filters
              </Button>
            ) : null}
            <aside className="hidden shrink-0 w-[280px] lg:block">
              <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
                {sidebar ?? null}
                {sidebarBottom ?? null}
              </div>
            </aside>
          </>
        ) : null}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
