export function StickyActionBar({ left, right, className = '' }) {
  return (
    <>
      {/* Mobile sticky bar */}
      <div className={['fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur md:hidden', className].join(' ')}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <div className="min-w-0">{left}</div>
          <div className="shrink-0">{right}</div>
        </div>
      </div>
      {/* Spacer so content isn't covered on mobile */}
      <div className="h-20 md:hidden" />
    </>
  )
}


