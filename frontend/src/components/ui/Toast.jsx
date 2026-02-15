import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/* eslint-disable react-refresh/only-export-components */
const ToastCtx = createContext(null)

function randomId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function toastColors(variant) {
  const v = String(variant || 'info')
  if (v === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  if (v === 'error') return 'border-red-200 bg-red-50 text-red-900'
  if (v === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-white text-slate-900'
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
      const toast = {
        id,
        title: title ? String(title) : '',
        description: description ? String(description) : '',
        variant,
      }
      setToasts((all) => [toast, ...all].slice(0, 5))
      const tm = setTimeout(() => remove(id), Math.max(1000, Number(durationMs) || 3500))
      timers.current.set(id, tm)
      return id
    },
    [remove],
  )

  const api = useMemo(() => {
    const success = (title, description) =>
      push({ title: title ? String(title) : 'Success', description: description ? String(description) : '', variant: 'success' })
    const error = (title, description) =>
      push({ title: title ? String(title) : 'Something went wrong', description: description ? String(description) : '', variant: 'error', durationMs: 5000 })
    const warning = (title, description) =>
      push({ title: title ? String(title) : 'Heads up', description: description ? String(description) : '', variant: 'warning', durationMs: 4500 })
    const info = (title, description) =>
      push({ title: title ? String(title) : '', description: description ? String(description) : '', variant: 'info' })
    return { push, remove, success, error, warning, info }
  }, [push, remove])

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Desktop: top-right. Mobile: bottom, full width-ish. */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] mx-auto flex max-w-6xl justify-end px-3">
        <div className="hidden w-full max-w-sm flex-col gap-2 md:flex">
          {toasts.map((t) => (
            <div key={t.id} className={['pointer-events-auto rounded-2xl border p-4 shadow-sm', toastColors(t.variant)].join(' ')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {t.title ? <div className="text-sm font-semibold">{t.title}</div> : null}
                  {t.description ? <div className="mt-1 text-sm opacity-90">{t.description}</div> : null}
                </div>
                <button type="button" onClick={() => remove(t.id)} className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 hover:opacity-100">
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[100] px-3 md:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} className={['pointer-events-auto rounded-2xl border p-4 shadow-sm', toastColors(t.variant)].join(' ')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {t.title ? <div className="truncate text-sm font-semibold">{t.title}</div> : null}
                  {t.description ? <div className="mt-1 text-sm opacity-90">{t.description}</div> : null}
                </div>
                <button type="button" onClick={() => remove(t.id)} className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 hover:opacity-100">
                  Close
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}


