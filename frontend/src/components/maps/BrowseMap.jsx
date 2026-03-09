/**
 * Map with pin drops (Airbnb-style). Shows markers for items with lat/lng;
 * hover or click on a pin shows a small card with title, subtitle, and link.
 * Expand button: uses Fullscreen API when supported, else a full-viewport overlay (e.g. iOS).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { loadGoogleMaps } from '../../lib/googleMaps.js'

const DEFAULT_CENTER = { lat: 7.9465, lng: -1.0232 } // Ghana
const DEFAULT_ZOOM = 6

/**
 * @param {Array<{ id: string, lat: number, lng: number, title: string, subtitle?: string, href?: string }>} pins
 * @param {{ lat: number, lng: number }} defaultCenter
 * @param {number} defaultZoom
 * @param {string} className
 * @param {string} emptyMessage - Shown when no pins but map is shown
 */
export function BrowseMap({ pins = [], defaultCenter, defaultZoom = DEFAULT_ZOOM, className = '', emptyMessage }) {
  const containerRef = useRef(null)
  const overlayContainerRef = useRef(null)
  const fullscreenWrapperRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)
  const lastContainerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loadingHint, setLoadingHint] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isExpandedOverlay, setIsExpandedOverlay] = useState(false)

  const tryNativeFullscreen = useCallback(() => {
    const wrapper = fullscreenWrapperRef.current
    if (!wrapper) return
    const req = wrapper.requestFullscreen ?? wrapper.webkitRequestFullscreen ?? wrapper.msRequestFullscreen
    if (typeof req !== 'function') {
      setIsExpandedOverlay(true)
      return
    }
    req.call(wrapper).then(() => {
      setIsFullscreen(true)
      const g = window.google?.maps
      if (mapRef.current && g?.event) {
        setTimeout(() => g.event.trigger(mapRef.current, 'resize'), 150)
      }
    }).catch(() => setIsExpandedOverlay(true))
  }, [])

  const exitExpanded = useCallback(() => {
    if (document.fullscreenElement) {
      const exit = document.exitFullscreen ?? document.webkitExitFullscreen ?? document.msExitFullscreen
      exit?.call(document)?.then(() => setIsFullscreen(false)).catch(() => setIsFullscreen(false))
    } else {
      setIsExpandedOverlay(false)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement || isExpandedOverlay) {
      exitExpanded()
      return
    }
    tryNativeFullscreen()
  }, [isExpandedOverlay, tryNativeFullscreen, exitExpanded])

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isExpandedOverlay || !mapRef.current) return
    const g = window.google?.maps
    if (g?.event) setTimeout(() => g.event.trigger(mapRef.current, 'resize'), 200)
  }, [isExpandedOverlay])

  const center = defaultCenter ?? DEFAULT_CENTER
  const pinsWithCoords = Array.isArray(pins)
    ? pins
        .map((p) => {
          const lat = p?.lat != null ? Number(p.lat) : NaN
          const lng = p?.lng != null ? Number(p.lng) : NaN
          if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
          return { ...p, lat, lng }
        })
        .filter(Boolean)
    : []

  useEffect(() => {
    let cancelled = false
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setFailed(true)
      return
    }
    loadGoogleMaps(apiKey).then((ok) => {
      if (cancelled) return
      setReady(Boolean(ok))
      setFailed(!ok)
    })
    const timeout = setTimeout(() => {
      if (cancelled) return
      setReady((r) => { if (!r) setFailed(true); return r })
    }, 12000)
    const hintTimeout = setTimeout(() => {
      if (cancelled) return
      setLoadingHint(true)
    }, 4000)
    return () => {
      cancelled = true
      clearTimeout(timeout)
      clearTimeout(hintTimeout)
    }
  }, [])

  // When map is inside a scrollable container (e.g. BrowseLayout sidebar), trigger resize when it becomes visible so tiles/pins render.
  useEffect(() => {
    if (!ready || isExpandedOverlay) return
    const el = fullscreenWrapperRef.current
    if (!el || !mapRef.current || typeof window.google?.maps?.event?.trigger !== 'function') return
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e?.isIntersecting && mapRef.current) {
          window.google.maps.event.trigger(mapRef.current, 'resize')
        }
      },
      { root: null, rootMargin: '0px', threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [ready, isExpandedOverlay, pinsWithCoords.length])

  useEffect(() => {
    const activeContainer = isExpandedOverlay ? overlayContainerRef.current : containerRef.current
    if (!ready || !activeContainer) return
    const g = window.google?.maps
    if (!g || typeof g.Map !== 'function') return

    if (mapRef.current && lastContainerRef.current !== activeContainer) {
      mapRef.current = null
      markersRef.current = []
      infoWindowRef.current = null
    }
    lastContainerRef.current = activeContainer

    if (!mapRef.current) {
      mapRef.current = new g.Map(activeContainer, {
        center: { lat: center.lat, lng: center.lng },
        zoom: defaultZoom,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [],
      })
      infoWindowRef.current = new g.InfoWindow()
      mapRef.current.addListener('click', () => infoWindowRef.current?.close())
    }

    const map = mapRef.current
    const infoWindow = infoWindowRef.current

    // Remove old markers
    markersRef.current.forEach((m) => {
      if (m?.setMap) m.setMap(null)
    })
    markersRef.current = []

    if (pinsWithCoords.length === 0) {
      map.setCenter(center)
      map.setZoom(defaultZoom)
      const t0 = setTimeout(() => g?.event && mapRef.current && g.event.trigger(mapRef.current, 'resize'), 150)
      return () => clearTimeout(t0)
    }

    const bounds = new g.LatLngBounds()

    pinsWithCoords.forEach((pin) => {
      const position = { lat: pin.lat, lng: pin.lng }
      const marker = new g.Marker({
        position,
        map,
        title: pin.title ?? '',
      })

      bounds.extend(position)

      const content = document.createElement('div')
      content.className = 'browse-map-popup'
      content.innerHTML = ''
      const title = String(pin.title ?? '').trim() || 'Listing'
      const subtitle = String(pin.subtitle ?? '').trim()
      const priceLabel = pin.priceLabel ?? pin.price ?? null
      const href = pin.href
      const imageUrl = pin.imageUrl || pin.image_url || null
      const isDark = document.documentElement.classList.contains('dark')
      const bg = isDark ? 'rgba(15,23,42,0.95)' : '#ffffff'
      const titleColor = isDark ? '#f8fafc' : '#0f172a'
      const subColor = isDark ? '#94a3b8' : '#475569'
      const linkColor = isDark ? '#34d399' : '#059669'
      const borderCl = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
      const imgHtml = imageUrl
        ? `<div style="width:100%;height:80px;border-radius:8px 8px 0 0;overflow:hidden;margin:-8px -8px 8px -8px;background:${isDark ? '#1e293b' : '#f1f5f9'}"><img src="${escapeHtml(imageUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy" /></div>`
        : ''
      const priceHtml = priceLabel ? `<div style="font-size:13px;font-weight:600;color:${isDark ? '#34d399' : '#059669'};margin-top:4px;">${escapeHtml(String(priceLabel))}</div>` : ''
      content.innerHTML = `
        <div class="browse-map-popup" style="background:${bg};color:${titleColor};border:1px solid ${borderCl};border-radius:12px;min-width:160px;max-width:240px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);">
          ${imgHtml}
          <div style="padding:8px 10px;">
            <div style="font-weight:600;font-size:14px;">${escapeHtml(title)}</div>
            ${subtitle ? `<div style="font-size:12px;color:${subColor};margin-top:4px;">${escapeHtml(subtitle)}</div>` : ''}
            ${priceHtml}
            ${href ? `<a href="${escapeHtml(href)}" style="font-size:12px;color:${linkColor};font-weight:500;margin-top:6px;display:inline-block;text-decoration:none;">View →</a>` : ''}
          </div>
        </div>
      `

      const openInfo = () => {
        infoWindow.setContent(content)
        infoWindow.open(map, marker)
      }

      marker.addListener('click', openInfo)
      marker.addListener('mouseover', openInfo)

      markersRef.current.push(marker)
    })

    if (pinsWithCoords.length === 1) {
      map.setCenter({ lat: pinsWithCoords[0].lat, lng: pinsWithCoords[0].lng })
      map.setZoom(10)
    } else if (pinsWithCoords.length > 1) {
      map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 })
    }

    // Resize after layout so map gets correct dimensions in scrollable/flex parents (e.g. BrowseLayout sidebar).
    const t = setTimeout(() => {
      if (g?.event && mapRef.current) {
        g.event.trigger(mapRef.current, 'resize')
        if (pinsWithCoords.length > 1) map.fitBounds(bounds, { top: 24, right: 24, bottom: 24, left: 24 })
      }
    }, 150)
    return () => clearTimeout(t)
  }, [ready, isExpandedOverlay, center.lat, center.lng, defaultZoom, pinsWithCoords])

  if (failed) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 p-4 min-h-[200px] flex flex-col items-center justify-center text-center dark:border-white/10 dark:bg-white/5 ${className}`}>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Map unavailable</p>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 max-w-[280px]">
          Set <strong>VITE_GOOGLE_MAPS_API_KEY</strong> in <code className="text-[11px]">frontend/.env</code> and rebuild. In Google Cloud enable <strong>Maps JavaScript API</strong> and <strong>Places API</strong>, and check referrer restrictions.
        </p>
      </div>
    )
  }

  if (!ready && !failed) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center h-64 gap-2 dark:border-white/10 dark:bg-white/5 ${className}`}>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading map…</p>
        {loadingHint ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[260px] text-center">
            If the map doesn’t load, hard-refresh (Cmd+Shift+R or Ctrl+Shift+R) to get the latest version.
          </p>
        ) : null}
      </div>
    )
  }

  const expanded = isFullscreen || isExpandedOverlay
  const expandButton = (
    <button
      type="button"
      onClick={toggleFullscreen}
      className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-white/95 text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 dark:border-white/20 dark:bg-slate-900/95 dark:text-slate-200 dark:hover:bg-white/10"
      aria-label={expanded ? 'Exit full screen' : 'Expand map to full screen'}
      title={expanded ? 'Exit full screen' : 'Expand map'}
    >
      {expanded ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      )}
    </button>
  )

  return (
    <div className={className}>
      {/* Inline map (hidden when overlay is showing so we don't have two map divs) */}
      {!isExpandedOverlay ? (
        <div
          ref={fullscreenWrapperRef}
          className="relative w-full h-48 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 dark:border-white/10 dark:bg-slate-800/50"
          style={{ minHeight: 192 }}
        >
          <div ref={containerRef} className="absolute inset-0" />
          {expandButton}
        </div>
      ) : (
        <div className="w-full h-48 rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800/50" style={{ minHeight: 192 }} />
      )}

      {/* Full-viewport overlay when native fullscreen not supported (e.g. iOS) */}
      {isExpandedOverlay &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
              <span className="text-sm font-medium text-white">Map</span>
              <button
                type="button"
                onClick={exitExpanded}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div ref={overlayContainerRef} className="relative flex-1 min-h-0 w-full" />
          </div>,
          document.body
        )}

      {emptyMessage && pinsWithCoords.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      ) : null}
      {pinsWithCoords.length > 0 && !isExpandedOverlay ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {pinsWithCoords.length} pin{pinsWithCoords.length === 1 ? '' : 's'} — tap the expand button for full screen
        </p>
      ) : null}
    </div>
  )
}

function escapeHtml(s) {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}
