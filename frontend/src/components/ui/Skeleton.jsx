export function Skeleton({ className = '', variant = 'default' }) {
  const base = variant === 'circle' ? 'rounded-full' : 'rounded-xl'
  return (
    <div
      className={[
        base,
        'bg-gradient-to-r from-stone-100 via-stone-200/60 to-stone-100 bg-[length:200%_100%] animate-shimmer',
        className,
      ].join(' ')}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ hasImage = false, className = '' }) {
  return (
    <div className={`rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm ${className}`}>
      {hasImage && <Skeleton className="mb-4 h-40 w-full" />}
      <div className="flex gap-3">
        <Skeleton variant="circle" className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

export function SkeletonDashboard({ cards = 4 }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-28 mb-2" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" className="h-10 w-10" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-40 mb-2" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
