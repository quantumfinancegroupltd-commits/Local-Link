import { useEffect, useMemo, useRef, useState } from 'react'

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readDraft(key) {
  if (!hasStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeDraft(key, value) {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota / privacy mode failures
  }
}

export function clearDraft(key) {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// Debounced autosave hook for form drafts.
export function useDraftAutosave({ key, data, enabled = true, debounceMs = 700 }) {
  const [savedAt, setSavedAt] = useState(null)
  const lastJsonRef = useRef('')

  const json = useMemo(() => {
    try {
      return JSON.stringify(data ?? null)
    } catch {
      return ''
    }
  }, [data])

  useEffect(() => {
    if (!enabled) return
    if (!key) return
    if (!json) return
    if (json === lastJsonRef.current) return

    const t = setTimeout(() => {
      writeDraft(key, data ?? null)
      lastJsonRef.current = json
      setSavedAt(Date.now())
    }, debounceMs)
    return () => clearTimeout(t)
  }, [key, json, enabled, debounceMs, data])

  return {
    savedAt,
    clear: () => clearDraft(key),
    load: () => readDraft(key),
  }
}


