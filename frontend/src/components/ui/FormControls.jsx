import { forwardRef } from 'react'

export function Label({ children, htmlFor, className = '', ...props }) {
  return (
    <label
      {...props}
      htmlFor={htmlFor}
      className={['mb-1 block text-sm font-medium text-slate-700', className].join(' ')}
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
        'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-80',
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
        'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-80',
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
        'focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-80',
        props.className ?? '',
      ].join(' ')}
    />
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60'
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-brand-emerald via-brand-lime to-brand-orange text-white shadow-sm hover:opacity-95 active:opacity-90'
      : variant === 'secondary'
        ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 active:bg-slate-100'
        : 'bg-slate-900 text-white hover:bg-slate-800'

  return <button {...props} className={[base, styles, className].join(' ')} />
}

export function Card({ children, className = '' }) {
  return <div className={['rounded-2xl border border-slate-200 bg-white p-6 shadow-sm', className].join(' ')}>{children}</div>
}


