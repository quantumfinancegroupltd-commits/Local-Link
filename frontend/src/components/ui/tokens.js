// Lightweight “design tokens” for consistent UX/UI without adding a full design system dependency.
// Keep these as Tailwind class strings so they compose naturally.

export const ui = {
  // Layout
  container: 'mx-auto max-w-6xl px-4',
  page: 'space-y-6',
  section: 'space-y-4',

  // Typography
  kicker: 'text-xs font-semibold uppercase tracking-wide text-slate-500',
  h1: 'text-2xl font-bold tracking-tight text-slate-900 md:text-3xl',
  h2: 'text-lg font-semibold text-slate-900',
  sub: 'text-sm leading-relaxed text-slate-600',
  label: 'text-xs font-semibold text-slate-700',
  muted: 'text-sm text-slate-600',

  // Card patterns
  card: 'rounded-2xl border border-slate-200 bg-white shadow-sm',
  cardHover: 'transition hover:shadow-md',
  cardPad: 'p-6',

  // Pills / chips
  chip: 'rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700',
}


