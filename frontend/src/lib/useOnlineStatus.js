import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => {
    try {
      return typeof navigator !== 'undefined' ? navigator.onLine !== false : true
    } catch {
      return true
    }
  })

  useEffect(() => {
    function onOnline() {
      setOnline(true)
    }
    function onOffline() {
      setOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { online }
}


