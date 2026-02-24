import { useState, useEffect } from 'react'
import { AssistantChat } from './AssistantChat.jsx'

const ASSISTANT_OPEN_EVENT = 'open-assistant'
const ASSISTANT_SEEN_KEY = 'locallink_assistant_seen'

export function AssistantFab() {
  const [open, setOpen] = useState(false)
  const [showBadge, setShowBadge] = useState(() => {
    try {
      return !sessionStorage.getItem(ASSISTANT_SEEN_KEY)
    } catch {
      return true
    }
  })

  useEffect(() => {
    const handler = () => {
      setOpen(true)
      try {
        sessionStorage.setItem(ASSISTANT_SEEN_KEY, '1')
      } catch {}
      setShowBadge(false)
    }
    window.addEventListener(ASSISTANT_OPEN_EVENT, handler)
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, handler)
  }, [])

  function toggleOpen() {
    setOpen((v) => {
      const next = !v
      if (next) {
        try {
          sessionStorage.setItem(ASSISTANT_SEEN_KEY, '1')
        } catch {}
        setShowBadge(false)
      }
      return next
    })
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <div className="relative h-14 w-14">
        <button
          type="button"
          onClick={toggleOpen}
          className="flex h-full w-full shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-emerald-600 shadow-lg ring-2 ring-emerald-500/30 transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          aria-label={open ? 'Close YAO' : 'Open YAO — Your LocalLink Guide'}
        >
          {open ? (
          <svg className="h-6 w-6 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <div className="absolute inset-[2px] overflow-hidden rounded-full">
              <img
                src="/yao-avatar.png"
                alt=""
                className="h-full w-full object-cover object-top"
                onError={(e) => {
                  e.target.style.display = 'none'
                  const fallback = e.target.nextElementSibling
                  if (fallback) fallback.classList.remove('hidden')
                }}
              />
            </div>
            <svg className="hidden h-6 w-6 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </>
        )}
        </button>
        {showBadge ? (
          <span
            className="absolute right-0 top-0 z-10 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-white bg-red-500"
            aria-hidden
          />
        ) : null}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            aria-label="Close assistant panel"
          />
          <div className="relative z-10 flex h-[min(85vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <AssistantChat onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  )
}

/** Call from Support page (or anywhere) to open the global assistant panel. */
export function openAssistant() {
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT))
}
