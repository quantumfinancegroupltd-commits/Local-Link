import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './FormControls.jsx'

export function Modal({ open, onClose, children, size = 'md', closeOnOverlay = true }) {
  const overlayRef = useRef(null)
  const previousFocus = useRef(null)

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      if (previousFocus.current instanceof HTMLElement) {
        previousFocus.current.focus()
        previousFocus.current = null
      }
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleOverlayClick = useCallback(
    (e) => {
      if (closeOnOverlay && e.target === overlayRef.current) onClose?.()
    },
    [closeOnOverlay, onClose],
  )

  if (!open) return null

  const sizeClass =
    size === 'sm' ? 'max-w-sm' :
    size === 'lg' ? 'max-w-2xl' :
    size === 'xl' ? 'max-w-4xl' :
    size === 'full' ? 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]' :
    'max-w-lg'

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 animate-overlay-in"
      role="dialog"
      aria-modal="true"
    >
      <div className={`relative w-full ${sizeClass} rounded-2xl bg-white shadow-xl animate-modal-in`}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalHeader({ children, onClose }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
      <h2 className="text-base font-bold text-stone-900">{children}</h2>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export function ModalBody({ children, className = '' }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>
}

export function ModalFooter({ children, className = '' }) {
  return <div className={`flex items-center justify-end gap-2 border-t border-stone-100 px-6 py-4 ${className}`}>{children}</div>
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}) {
  const confirmStyles =
    variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
      : ''

  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>{title}</ModalHeader>
      {description ? (
        <ModalBody>
          <p className="text-sm text-stone-600">{description}</p>
        </ModalBody>
      ) : null}
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'dark' : 'primary'}
          onClick={onConfirm}
          disabled={loading}
          className={confirmStyles}
        >
          {loading ? 'Please wait…' : confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
