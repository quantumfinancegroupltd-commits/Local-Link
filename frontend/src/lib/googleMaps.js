/**
 * Load Google Maps JavaScript API (same script as LocationInput).
 * Resolves when window.google.maps.Map is available (script onload can fire before Map is ready).
 * Reuses existing script if already in the page.
 */
let loadPromise = null

function isMapsReady() {
  return typeof window !== 'undefined' && typeof window.google?.maps?.Map === 'function'
}

export function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.resolve(false)
  if (isMapsReady()) return Promise.resolve(true)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }

    const poll = (deadline = Date.now() + 15000) => {
      if (isMapsReady()) return resolve(true)
      if (Date.now() > deadline) return resolve(false)
      setTimeout(() => poll(deadline), 80)
    }

    const existing = document.querySelector('script[data-ll-google-maps="1"]')
    if (existing) {
      poll()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&v=weekly`
    script.async = true
    script.defer = true
    script.dataset.llGoogleMaps = '1'
    script.onload = () => poll()
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return loadPromise
}
