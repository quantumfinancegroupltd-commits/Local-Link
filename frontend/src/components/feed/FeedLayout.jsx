import { FeedSidebarLeft } from './FeedSidebarLeft.jsx'
import { FeedSidebarRight } from './FeedSidebarRight.jsx'

export function FeedLayout({ children, leftSuggestedSection, showLeft = true, showRight = true }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
        <div className="flex min-w-0 gap-6">
          {showLeft ? (
            <div className="hidden w-[260px] shrink-0 space-y-4 lg:block">
              <FeedSidebarLeft />
              {leftSuggestedSection ?? null}
            </div>
          ) : null}
          <main className="min-w-0 flex-1 max-w-[720px]">{children}</main>
          {showRight ? (
            <div className="hidden w-[320px] shrink-0 xl:block">
              <FeedSidebarRight />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
