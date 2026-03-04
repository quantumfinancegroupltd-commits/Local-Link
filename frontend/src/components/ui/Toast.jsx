import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastCtx = createContext(null)

function randomId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

const ICONS = {
  success: (
    <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
}

function toastStyles(variant) {
  const v = String(variant || 'info')
  if (v === 'success') return 'border-emerald-200 bg-emerald-50'
  if (v === 'error') return 'border-red-200 bg-red-50'
  if (v === 'warning') return 'border-amber-200 bg-amber-50'
  return 'border-stone-200 bg-white'
}

function ToastItem({ toast, onRemove, position }) {
  return (
    <div
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-sm',
        toastStyles(toast.variant),
        position === 'bottom' ? 'animate-toast-enter-bottom' : 'animate-toast-enter',
      ].join(' ')}
      role="alert"
    >
      <div className="shrink-0 pt-0.5">{ICONS[toast.variant] || ICONS.info}</div>
      <div className="min-w-0 flex-1">
        {toast.title ? <div className="text-sm font-semibold text-stone-900">{toast.title}</div> : null}
        {toast.description ? <div className={`text-sm text-stone-600 ${toast.title ? 'mt-0.5' : ''}`}>{toast.description}</div> : null}
      </div>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="shrink-0 rounded-lg p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const remove = useCallback((id) => {
    setToasts((all) => all.filter((t) => t.id !== id))
    const tm = timers.current.get(id)
    if (tm) clearTimeout(tm)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    ({ title, description, variant = 'info', durationMs = 3500 } = {}) => {
      const id = randomId()
      const toast = { id, title: title ? String(title) : '', description: description ? String(description) : '', variant }
      setToasts((all) => [toast, ...all].slice(0, 5))
      const tm = setTimeout(() => remove(id), Math.max(1000, Number(durationMs) || 3500))
      timers.current.set(id, tm)
      return id
    },
    [remove],
  )

  const api = useMemo(() => {
    const success = (title, description) => push({ title: title ? String(title) : 'Success', description: description ? String(description) : '', variant: 'success' })
    const error = (title, description) => push({ title: title ? String(title) : 'Something went wrong', description: description ? String(description) : '', variant: 'error', durationMs: 5000 })
    const warning = (title, description) => push({ title: title ? String(title) : 'Heads up', description: description ? String(description) : '', variant: 'warning', durationMs: 4500 })
    const info = (title, description) => push({ title: title ? String(title) : '', description: description ? String(description) : '', variant: 'info' })
    return { push, remove, success, error, warning, info }
  }, [push, remove])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Desktop: top-right */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto hidden max-w-6xl justify-end px-3 md:flex">
        <div className="flex w-full max-w-sm flex-col gap-2">
          {toasts.map((t) => <ToastItem key={t.id} toast={t} onRemove={remove} position="top" />)}
        </div>
      </div>
      {/* Mobile: bottom */}
      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[100] px-3 md:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          {toasts.map((t) => <ToastItem key={t.id} toast={t} onRemove={remove} position="bottom" />)}
        </div>
      </div>
    </ToastCtx.Provider>
  )
}

/* eslint-disable react-refresh/only-export-components */
export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
