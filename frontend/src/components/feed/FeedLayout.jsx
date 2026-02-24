import { FeedSidebarLeft } from './FeedSidebarLeft.jsx'
import { FeedSidebarRight } from './FeedSidebarRight.jsx'

/**
 * 3-column feed layout: left nav (260px), main (fluid max 720px), right (320px).
 * Mobile: main only; sidebars collapse (caller can render compact sections above feed).
 */
export function FeedLayout({ children, suggestedSection, showLeft = true, showRight = true }) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <div className="flex gap-6">
        {showLeft ? (
          <div className="hidden w-[260px] shrink-0 lg:block">
            <FeedSidebarLeft />
          </div>
        ) : null}
        <main className="min-w-0 flex-1 max-w-[720px]">{children}</main>
        {showRight ? (
          <div className="hidden w-[320px] shrink-0 xl:block">
            <FeedSidebarRight suggestedSection={suggestedSection} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
