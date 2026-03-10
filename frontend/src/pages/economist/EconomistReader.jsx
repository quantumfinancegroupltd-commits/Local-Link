import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import { http, getApiOrigin } from '../../api/http.js'
import { usePageMeta } from '../../components/ui/seo.js'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import './EconomistReader.css'

// Polyfill URL.parse for mobile browsers (pdfjs uses it; not in standard Web API)
if (typeof URL !== 'undefined' && typeof URL.parse !== 'function') {
  URL.parse = function (url, base) {
    try {
      return new URL(url, base)
    } catch {
      return null
    }
  }
}

// PDF.js worker: Vite bundles it; nginx must serve .mjs as application/javascript (see frontend.conf)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

// Economist PDFs and covers are static files served from the same origin as the SPA (e.g. /economist-volume-02.pdf).
// Always use the current window origin so they load from the frontend host, not the API host.
function resolvePdfUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const s = url.trim()
  if (s.startsWith('http')) return s
  try {
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : getApiOrigin()
    return origin ? `${origin.replace(/\/$/, '')}${s.startsWith('/') ? s : `/${s}`}` : s
  } catch {
    return s.startsWith('/') ? s : `/${s}`
  }
}

const ZOOM_LEVELS = [0.6, 0.8, 1, 1.25, 1.5, 1.75, 2]
const DEFAULT_ZOOM_INDEX = 2 // 1
const SWIPE_THRESHOLD = 60
const GAP = 16
const SIDE_MARGIN = 48
const SAFETY_FACTOR = 0.92

function useSpreadMode() {
  const [spread, setSpread] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const fn = () => setSpread(mql.matches)
    fn()
    mql.addEventListener('change', fn)
    return () => mql.removeEventListener('change', fn)
  }, [])
  return spread
}

export function EconomistReader() {
  const { slug } = useParams()
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const touchStartX = useRef(0)
  const readStartTime = useRef(null)
  const maxPageViewed = useRef(1)
  const [issue, setIssue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scaleIndex, setScaleIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [fullscreen, setFullscreen] = useState(false)
  const [overlayFullscreen, setOverlayFullscreen] = useState(false)
  const [pdfLoadError, setPdfLoadError] = useState(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [pageTransition, setPageTransition] = useState(false)
  const [containerWidth, setContainerWidth] = useState(null)
  const spreadMode = useSpreadMode()
  const pdfSrc = issue?.pdf_url ? resolvePdfUrl(issue.pdf_url) : ''

  // Fit to width: measure viewer container so full page(s) are visible (no left/right cut-off)
  useEffect(() => {
    const el = viewerRef.current?.parentElement
    if (!el) return
    const update = () => {
      const w = el.getBoundingClientRect().width
      if (typeof w === 'number' && w > 0) setContainerWidth(w)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pdfSrc, numPages])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!slug) {
        setError('Missing issue')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      setPdfLoadError(null)
      try {
        const r = await http.get(`/economist/${encodeURIComponent(slug)}`)
        if (!cancelled) {
          setIssue(r.data)
          setPageNumber(1)
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message ?? e?.message ?? 'Issue not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  const onDocumentLoadSuccess = useCallback(({ numPages: n }) => {
    setNumPages(n)
    setPdfLoadError(null)
  }, [])

  useEffect(() => {
    if (!issue?.slug || !pdfSrc) return
    readStartTime.current = Date.now()
    maxPageViewed.current = 1
    const sendRead = () => {
      if (!readStartTime.current || !issue?.slug) return
      const timeSpent = Math.round((Date.now() - readStartTime.current) / 1000)
      http.post('/economist/read', {
        issue_slug: issue.slug,
        pages_viewed: maxPageViewed.current,
        time_spent_seconds: timeSpent,
        completed: numPages != null && maxPageViewed.current >= numPages,
      }).catch(() => {})
      readStartTime.current = null
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') sendRead()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      sendRead()
    }
  }, [issue?.slug, pdfSrc, numPages])

  useEffect(() => {
    maxPageViewed.current = Math.max(maxPageViewed.current, pageNumber)
  }, [pageNumber])

  const onDocumentLoadError = useCallback((e) => {
    setPdfLoadError(e?.message ?? 'Failed to load PDF')
  }, [])

  useEffect(() => {
    if (!numPages || pageNumber < 1) return
    if (pageNumber > numPages) setPageNumber(numPages)
  }, [numPages, pageNumber])

  const goPrev = useCallback(() => {
    if (spreadMode) {
      setPageNumber((p) => Math.max(1, p - 2))
    } else {
      setPageNumber((p) => Math.max(1, p - 1))
    }
  }, [spreadMode])

  const goNext = useCallback(() => {
    if (spreadMode) {
      setPageNumber((p) => Math.min(numPages ?? 1, p + 2))
    } else {
      setPageNumber((p) => Math.min(numPages ?? 1, p + 1))
    }
  }, [spreadMode, numPages])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.target?.closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft') {
        goPrev()
        e.preventDefault()
      }
      if (e.key === 'ArrowRight') {
        goNext()
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goPrev, goNext])

  const onTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0
  }, [])

  const onTouchEnd = useCallback(
    (e) => {
      const endX = e.changedTouches[0]?.clientX ?? 0
      const delta = touchStartX.current - endX
      if (delta > SWIPE_THRESHOLD) goNext()
      else if (delta < -SWIPE_THRESHOLD) goPrev()
    },
    [goPrev, goNext],
  )

  usePageMeta({
    title: issue ? `${issue.title} • LocalLink Economist` : 'LocalLink Economist',
    description: issue?.summary ?? 'A monthly digital magazine analysing Ghana’s local labour, trade, produce and SME economy.',
    image: issue?.cover_image_url?.startsWith('http') ? issue.cover_image_url : (typeof window !== 'undefined' && issue?.cover_image_url ? `${window.location.origin}${issue.cover_image_url.startsWith('/') ? '' : '/'}${issue.cover_image_url}` : undefined),
    url: typeof window !== 'undefined' && issue?.slug ? `${window.location.origin}/economist/${issue.slug}` : undefined,
  })

  // Use Page width prop so the viewer never clips: each page is drawn at exactly this pixel width
  // In overlay fullscreen use almost full width (minimal margin) for a bigger magazine
  const fullscreenWidth = overlayFullscreen && containerWidth != null && containerWidth > 0
  const rawAvailable = containerWidth != null && containerWidth > 0
    ? (fullscreenWidth ? containerWidth - 16 : containerWidth - SIDE_MARGIN * 2)
    : 700
  const availableWidth = Math.floor(rawAvailable * (fullscreenWidth ? 1 : SAFETY_FACTOR))
  const pageDisplayWidth = spreadMode
    ? Math.floor((availableWidth - GAP) / 2)
    : Math.floor(availableWidth)
  const scale = (ZOOM_LEVELS[scaleIndex] ?? 1)
  const zoomedPageWidth = Math.round(pageDisplayWidth * scale)
  const zoomOut = () => setScaleIndex((i) => Math.max(0, i - 1))
  const zoomIn = () => setScaleIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))

  const setPageWithTransition = useCallback((n) => {
    setPageTransition(true)
    setTimeout(() => {
      setPageNumber(Math.max(1, Math.min(numPages ?? 1, n)))
      setPageTransition(false)
    }, 80)
  }, [numPages])

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const isInNativeFullscreen = !!document.fullscreenElement
    if (isInNativeFullscreen || overlayFullscreen) {
      if (document.fullscreenElement) {
        const exit = document.exitFullscreen ?? document.webkitExitFullscreen
        exit?.call(document)?.then(() => setFullscreen(false)).catch(() => setFullscreen(false))
      }
      setOverlayFullscreen(false)
      return
    }

    const req = container.requestFullscreen ?? container.webkitRequestFullscreen
    if (req) {
      req.call(container).then(() => setFullscreen(true)).catch(() => {
        setOverlayFullscreen(true)
      })
    } else {
      setOverlayFullscreen(true)
    }
  }, [overlayFullscreen])

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(!!document.fullscreenElement)
      if (!document.fullscreenElement) setOverlayFullscreen(false)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center text-slate-600 dark:text-slate-400">
        Loading issue…
      </div>
    )
  }
  if (error || !issue) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-700 dark:text-red-400">{error || 'Issue not found.'}</p>
        <Link to="/news" className="mt-4 inline-block text-sm font-semibold text-[#b9141a] hover:underline">
          ← Back to News
        </Link>
      </div>
    )
  }

  const issueDate = issue.issue_date ? new Date(issue.issue_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : ''
  const leftPage = spreadMode ? (pageNumber % 2 === 0 ? pageNumber - 1 : pageNumber) : pageNumber
  const rightPage = spreadMode ? leftPage + 1 : null

  const viewerContent = pdfSrc ? (
    <div
      ref={viewerRef}
      className="flex flex-row flex-nowrap items-start justify-center gap-4 py-4"
      style={{
        minWidth: spreadMode ? zoomedPageWidth * 2 + GAP : zoomedPageWidth,
        touchAction: 'pan-x',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Document
        file={pdfSrc}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading={
          <div className="flex min-h-[60vh] min-w-full items-center justify-center text-slate-500 dark:text-slate-400">
            Loading PDF…
          </div>
        }
        error={
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Could not load PDF</p>
            <p className="mt-1 text-sm">{pdfLoadError || 'The file may be missing or in a different format.'}</p>
            <a href={pdfSrc} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-[#b9141a] hover:underline">
              Open PDF in new tab
            </a>
          </div>
        }
      >
        <div className={`flex flex-row flex-nowrap items-start justify-center gap-4 ${pageTransition ? 'opacity-70' : 'opacity-100'} transition-opacity duration-200`}>
          <div key={leftPage} className="economist-page-wrap relative overflow-hidden rounded shadow-md">
            <Page
              pageNumber={leftPage}
              width={zoomedPageWidth}
              renderTextLayer
              renderAnnotationLayer
            />
          </div>
          {rightPage != null && rightPage <= (numPages ?? 0) && (
            <div key={rightPage} className="economist-page-wrap relative overflow-hidden rounded shadow-md">
              <Page
                pageNumber={rightPage}
                width={zoomedPageWidth}
                renderTextLayer
                renderAnnotationLayer
              />
            </div>
          )}
        </div>
      </Document>
    </div>
  ) : (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">PDF not available</p>
      <p className="mt-1 text-sm">This issue does not have a PDF file attached yet.</p>
      <Link to="/news" className="mt-4 inline-block text-sm font-semibold text-[#b9141a] hover:underline">
        ← Back to News
      </Link>
    </div>
  )

  const tocList = numPages != null ? Array.from({ length: numPages }, (_, i) => i + 1) : []

  const inFullscreen = fullscreen || overlayFullscreen

  // On mobile, overlay fullscreen is rendered in a portal so it sits above app header/footer (escape stacking context)
  const overlayFullscreenPortal =
    overlayFullscreen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95">
        <div className="flex shrink-0 justify-end p-1.5">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-slate-800 shadow-lg backdrop-blur"
            aria-label="Exit fullscreen"
          >
            ✕ Exit fullscreen
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="flex min-h-full items-center justify-center px-1 py-2">
            {viewerContent}
          </div>
        </div>
      </div>,
      document.body
    )

  return (
    <>
      {overlayFullscreenPortal}
      <div
        ref={containerRef}
        className="min-h-screen bg-[#F8F8F8] dark:bg-black"
      >
      <header className={`sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-black/95 ${overlayFullscreen ? 'hidden' : ''}`}>
        <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/economist" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              ← Archive
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <div>
              <span className="font-serif text-xs font-bold uppercase tracking-wider text-[#b9141a]">
                Vol {String(issue.volume_number).padStart(2, '0')} — {issueDate}
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{issue.title}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pdfSrc && (
              <>
                <nav className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/50">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={spreadMode ? leftPage <= 1 : pageNumber <= 1}
                    className="rounded-l-lg px-3 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Previous page"
                  >
                    ‹
                  </button>
                  <span className="min-w-[4rem] px-2 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                    {spreadMode ? `${leftPage}–${rightPage != null && rightPage <= (numPages ?? 0) ? rightPage : leftPage}` : pageNumber} / {numPages ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!numPages || (spreadMode ? rightPage >= numPages : pageNumber >= numPages)}
                    className="rounded-r-lg px-3 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Next page"
                  >
                    ›
                  </button>
                </nav>
                <button
                  type="button"
                  onClick={() => setTocOpen((o) => !o)}
                  className="hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 lg:inline-flex"
                  aria-label="Table of contents"
                >
                  Contents
                </button>
                <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/50">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={scaleIndex <= 0}
                    className="rounded-l-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <span className="min-w-[2.5rem] px-1 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={scaleIndex >= ZOOM_LEVELS.length - 1}
                    className="rounded-r-lg px-2.5 py-2 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  aria-label={inFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {inFullscreen ? '✕' : '⛶'}
                </button>
              </>
            )}
            {pdfSrc && (
              <a
                href={pdfSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Download
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                try {
                  navigator.clipboard.writeText(window.location.href)
                  window.alert('Link copied to clipboard.')
                } catch {
                  window.alert('Share: ' + window.location.href)
                }
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1920px] gap-4 px-2 py-4 sm:px-4 sm:py-6">
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-black/80 px-2 sm:px-4" style={{ minWidth: 0 }}>
          {!overlayFullscreen && viewerContent}
        </div>
        {pdfSrc && numPages != null && !overlayFullscreen && (
          <>
            <aside
              className={`z-20 shrink-0 ${tocOpen ? 'fixed right-0 top-0 bottom-0 w-64 border-l border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-black/90 lg:relative lg:!w-52 lg:border-0 lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:shadow-none dark:lg:bg-black/50' : 'hidden'} lg:block`}
              aria-label="Table of contents"
            >
              <div className="sticky top-24">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Contents
                  </p>
                  <button type="button" onClick={() => setTocOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden" aria-label="Close">×</button>
                </div>
                <nav className="max-h-[60vh] overflow-y-auto">
                  {tocList.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setPageWithTransition(n)
                        setTocOpen(false)
                      }}
                      className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                        (spreadMode ? (n >= leftPage && n <= (rightPage ?? leftPage)) : n === pageNumber)
                          ? 'bg-[#b9141a]/15 font-semibold text-[#b9141a]'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10'
                      }`}
                    >
                      Page {n}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>
            <button
              type="button"
              onClick={() => setTocOpen((o) => !o)}
              className="fixed bottom-4 right-4 z-20 rounded-full bg-[#b9141a] p-3 text-white shadow-lg lg:hidden"
              aria-label="Table of contents"
            >
              <span className="text-sm font-bold">≡</span>
            </button>
          </>
        )}
      </main>
      {pdfSrc && numPages != null && tocOpen && !overlayFullscreen && (
        <div
          className="fixed inset-0 z-10 bg-black/40 lg:hidden"
          aria-hidden
          onClick={() => setTocOpen(false)}
        />
      )}
      {pdfSrc && numPages != null && !overlayFullscreen && (
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
          Turn pages left ← → (keys or swipe). {spreadMode ? 'Two-page spread.' : 'Single page.'}
        </p>
      )}
      {issue && !overlayFullscreen && (
        <div className="mx-auto mt-6 max-w-3xl rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-black/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Cite this report
          </p>
          <p className="mt-1 font-serif text-sm text-slate-700 dark:text-slate-300">
            LocalLink Economist ({issueDate}). {issue.title}. LocalLink. {typeof window !== 'undefined' ? window.location.href : ''}
          </p>
          <button
            type="button"
            onClick={() => {
              const cite = `LocalLink Economist (${issueDate}). ${issue.title}. LocalLink. ${typeof window !== 'undefined' ? window.location.href : ''}`
              try {
                navigator.clipboard.writeText(cite)
                window.alert('Citation copied to clipboard.')
              } catch {
                window.alert(cite)
              }
            }}
            className="mt-2 text-xs font-medium text-[#b9141a] hover:underline"
          >
            Copy citation
          </button>
        </div>
      )}
    </div>
    </>
  )
}
