import { FeedSidebarLeft } from './FeedSidebarLeft.jsx'
import { FeedSidebarRight } from './FeedSidebarRight.jsx'

/**
 * 3-column feed layout: left nav + suggested (260px), main (fluid max 720px), right trending + events (320px).
 * Matches mockup: left = Home/Trending/My Network/Jobs & Offers/Marketplace/Messages + Suggested to Follow.
 */
export function FeedLayout({ children, leftSuggestedSection, showLeft = true, showRight = true }) {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <div className="flex gap-6">
        {showLeft ? (
          <div className="hidden w-[260px] shrink-0 space-y-4 lg:block">
            <FeedSidebarLeft />
            {leftSuggestedSection ? <div className="rounded-2xl">{leftSuggestedSection}</div> : null}
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
  )
}
