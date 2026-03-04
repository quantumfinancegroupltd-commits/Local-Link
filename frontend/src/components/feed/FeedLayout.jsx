import { FeedSidebarLeft } from './FeedSidebarLeft.jsx'
import { FeedSidebarRight } from './FeedSidebarRight.jsx'

export function FeedLayout({ children, leftSuggestedSection, showLeft = true, showRight = true }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col px-4 py-6 md:px-6">
        <div className="flex min-h-0 min-w-0 flex-1 gap-6">
          {showLeft ? (
            <div className="hidden w-[260px] shrink-0 flex-col space-y-4 overflow-y-auto lg:flex">
              <FeedSidebarLeft />
              {leftSuggestedSection ?? null}
            </div>
          ) : null}
          <main className="min-h-0 min-w-0 flex-1 max-w-[720px] overflow-y-auto">
            {children}
          </main>
          {showRight ? (
            <div className="hidden w-[320px] shrink-0 flex-col overflow-y-auto xl:flex">
              <FeedSidebarRight />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
