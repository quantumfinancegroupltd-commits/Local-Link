import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'll_theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {}
  return 'light'
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
  }, [theme])

  const setTheme = useCallback((next) => {
    setThemeState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      return value === 'dark' || value === 'light' ? value : prev
    })
  }, [])

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggle }
}
