import { forwardRef } from 'react'

export function Label({ children, htmlFor, className = '', ...props }) {
  return (
    <label
      {...props}
      htmlFor={htmlFor}
      className={['mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300', className].join(' ')}
    >
      {children}
    </label>
  )
}

export const Input = forwardRef(function Input(props, ref) {
  return (
    <input
      {...props}
      ref={ref}
      className={[
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
        'focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-80',
        'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-900/50 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500',
        props.className ?? '',
      ].join(' ')}
    />
  )
})

export function Textarea(props) {
  return (
    <textarea
      {...props}
      className={[
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
        'focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-80',
        'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-900/50 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500',
        props.className ?? '',
      ].join(' ')}
    />
  )
}

export function Select(props) {
  return (
    <select
      {...props}
      className={[
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none',
        'focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-80',
        'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-orange-400 dark:focus:ring-orange-900/50 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500',
        props.className ?? '',
      ].join(' ')}
    />
  )
}

export function Button({ variant = 'primary', size, className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-xl font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
  const styles =
    variant === 'primary'
      ? 'bg-brand-gradient hover:bg-brand-gradient-hover active:opacity-95 text-white shadow-sm dark:focus:ring-orange-400/50'
      : variant === 'secondary'
        ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15 dark:active:bg-white/20'
        : 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 dark:active:bg-slate-300'

  return <button {...props} className={[base, sizeClass, styles, className].join(' ')} />
}

export function Card({ children, className = '' }) {
  return (
    <div
      className={[
        'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-100',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}


