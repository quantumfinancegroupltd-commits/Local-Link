// Lightweight “design tokens” for consistent UX/UI without adding a full design system dependency.
// Keep these as Tailwind class strings so they compose naturally.

export const ui = {
  // Layout
  container: 'mx-auto max-w-6xl px-4',
  page: 'space-y-6',
  section: 'space-y-4',

  // Typography (heading font for hierarchy; body stays Inter)
  kicker: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
  display: 'font-heading text-3xl font-bold leading-[1.08] tracking-tight text-slate-900 md:text-5xl dark:text-white',
  h1: 'font-heading text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-white',
  h2: 'font-heading text-lg font-semibold text-slate-900 dark:text-white',
  sub: 'text-sm leading-relaxed text-slate-600 dark:text-slate-400',
  label: 'text-xs font-semibold text-slate-700 dark:text-slate-300',
  muted: 'text-sm text-slate-600 dark:text-slate-400',

  // Card patterns (dark: translucent over black)
  card: 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none',
  cardHover: 'transition hover:shadow-md dark:hover:bg-white/[0.07]',
  cardPad: 'p-6',

  // One bold brand moment (hero CTA band, highlight card)
  brandBand: 'bg-brand-gradient',

  // Pills / chips
  chip: 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/20 dark:bg-white/10 dark:text-slate-200',
}


