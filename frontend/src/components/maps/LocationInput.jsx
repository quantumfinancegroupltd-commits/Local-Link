import { useEffect, useRef, useState } from 'react'
import { Input } from '../ui/FormControls.jsx'

let googleMapsLoadPromise = null

function waitForGooglePlaces({ timeoutMs = 5000 } = {}) {
  const started = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      const ok = Boolean(window.google?.maps?.places && (window.google.maps.places.Autocomplete || window.google.maps.places.PlaceAutocompleteElement))
      if (ok) return resolve(true)
      if (Date.now() - started >= timeoutMs) return resolve(false)
      setTimeout(tick, 50)
    }
    tick()
  })
}

function loadGoogleMapsPlaces(apiKey) {
  if (!apiKey) return Promise.resolve(false)
  if (window.google?.maps?.places) return Promise.resolve(true)
  if (googleMapsLoadPromise) return googleMapsLoadPromise

  googleMapsLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-ll-google-maps="1"]')
    if (existing) {
      existing.addEventListener('load', async () => resolve(await waitForGooglePlaces()))
      existing.addEventListener('error', () => resolve(false))
      return
    }

    const script = document.createElement('script')
    // "loading=async" is Google-recommended to avoid suboptimal loading warnings.
    // "v=weekly" keeps behavior current without pinning.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async&v=weekly`
    script.async = true
    script.defer = true
    script.dataset.llGoogleMaps = '1'
    script.onload = async () => resolve(await waitForGooglePlaces())
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return googleMapsLoadPromise
}

export function LocationInput({
  id,
  value,
  onChange,
  onPick,
  placeholder = 'Start typing an address or area…',
  disabled,
  inputProps,
}) {
  const inputRef = useRef(null)
  const [placesReady, setPlacesReady] = useState(false)
  const [placesFailed, setPlacesFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    loadGoogleMapsPlaces(key).then((ok) => {
      if (cancelled) return
      const ready = Boolean(ok)
      setPlacesReady(ready)
      setPlacesFailed(!ready && Boolean(key))
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!placesReady) return
    if (!inputRef.current) return
    if (!window.google?.maps?.places?.Autocomplete) return

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      types: ['geocode'],
    })

    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      const formatted = place?.formatted_address || place?.name || ''
      const lat = place?.geometry?.location?.lat?.()
      const lng = place?.geometry?.location?.lng?.()
      const placeId = place?.place_id || null
      if (formatted) onChange(formatted)
      if (onPick) onPick({ formatted, lat, lng, placeId })
    })

    return () => {
      // Google listener cleanup is handled internally; nothing required here for MVP.
    }
  }, [placesReady, onChange, onPick])

  return (
    <div className="space-y-2">
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        {...(inputProps ?? {})}
      />
      {placesFailed ? (
        <div className="text-xs text-red-700">
          Google Places couldn’t load. In Google Cloud, ensure <span className="font-semibold">Maps JavaScript API</span> and{' '}
          <span className="font-semibold">Places API</span> are enabled (and billing + referrer restrictions are correct).
          <span className="ml-1 text-slate-600">
            If you see <span className="font-semibold">LegacyApiNotActivatedMapError</span>, enable Places API (Legacy) too.
          </span>
        </div>
      ) : !placesReady ? (
        <div className="text-xs text-slate-500">Loading Google Places…</div>
      ) : null}
    </div>
  )
}


