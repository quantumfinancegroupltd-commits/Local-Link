import { useRef } from 'react'

export function HorizontalScroller({ title, subtitle, children }) {
  const ref = useRef(null)

  function scrollBy(delta) {
    ref.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <section className="group/rail space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
      </div>

      <div className="relative">
        {/* Floating arrows (desktop) */}
        <button
          type="button"
          onClick={() => scrollBy(-520)}
          className={[
            'absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 md:flex',
            'h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95',
            'text-slate-700 shadow-sm backdrop-blur transition',
            'opacity-0 group-hover/rail:opacity-100',
            'hover:bg-white',
          ].join(' ')}
          aria-label="Scroll left"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => scrollBy(520)}
          className={[
            'absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 md:flex',
            'h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95',
            'text-slate-700 shadow-sm backdrop-blur transition',
            'opacity-0 group-hover/rail:opacity-100',
            'hover:bg-white',
          ].join(' ')}
          aria-label="Scroll right"
        >
          →
        </button>

        <div
          ref={ref}
          className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {children}
        </div>
      </div>
    </section>
  )
}


