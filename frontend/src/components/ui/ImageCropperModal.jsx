import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card } from './FormControls.jsx'

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

async function fileToImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    return { img, revoke: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

async function cropToJpegFile({ file, offsetX, offsetY, scale, boxW, boxH, outW, outH, quality = 0.9 }) {
  const { img, revoke } = await fileToImage(file)
  try {
    const imgW = img.naturalWidth
    const imgH = img.naturalHeight
    if (!imgW || !imgH) throw new Error('Invalid image')

    const displayedW = imgW * scale
    const displayedH = imgH * scale

    const x0 = boxW / 2 - displayedW / 2 + offsetX
    const y0 = boxH / 2 - displayedH / 2 + offsetY

    const cropXDisplay = -x0
    const cropYDisplay = -y0
    const cropWDisplay = boxW
    const cropHDisplay = boxH

    const sx = cropXDisplay / scale
    const sy = cropYDisplay / scale
    const sWidth = cropWDisplay / scale
    const sHeight = cropHDisplay / scale

    const safeSx = clamp(sx, 0, Math.max(0, imgW - sWidth))
    const safeSy = clamp(sy, 0, Math.max(0, imgH - sHeight))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, safeSx, safeSy, sWidth, sHeight, 0, 0, outW, outH)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('Failed to export image')
    return new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' })
  } finally {
    revoke()
  }
}

export function ImageCropperModal({
  open,
  file,
  title,
  aspect = 1,
  outputMaxWidth = 1024,
  onCancel,
  onConfirm,
}) {
  const boxRef = useRef(null)
  const imgRef = useRef(null)

  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 })

  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [maxScale, setMaxScale] = useState(3)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [drag, setDrag] = useState(null) // { pointerId, startX, startY, startOffsetX, startOffsetY }

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!objectUrl) return
    return () => URL.revokeObjectURL(objectUrl)
  }, [objectUrl])

  useEffect(() => {
    if (!open) return
    if (!boxRef.current) return
    const el = boxRef.current

    const measure = () => {
      const r = el.getBoundingClientRect()
      setBoxSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) })
    }
    measure()

    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  useEffect(() => {
    // Reset editor when file changes
    setError(null)
    setBusy(false)
    setDrag(null)
    setOffset({ x: 0, y: 0 })
  }, [file])

  useEffect(() => {
    const w = imgNatural.w
    const h = imgNatural.h
    const bw = boxSize.w
    const bh = boxSize.h
    if (!w || !h || !bw || !bh) return
    // Ensure the image fully covers the crop box at minimum zoom
    const s0 = Math.max(bw / w, bh / h)
    const max = s0 * 3
    setMinScale(s0)
    setMaxScale(max)
    setScale((prev) => clamp(prev, s0, max))
    setOffset({ x: 0, y: 0 })
  }, [imgNatural, boxSize])

  function clampOffset(next, nextScale = scale) {
    const w = imgNatural.w
    const h = imgNatural.h
    const bw = boxSize.w
    const bh = boxSize.h
    if (!w || !h || !bw || !bh) return next
    const displayedW = w * nextScale
    const displayedH = h * nextScale
    const maxX = Math.max(0, (displayedW - bw) / 2)
    const maxY = Math.max(0, (displayedH - bh) / 2)
    return {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    }
  }

  function onPointerDown(e) {
    if (busy) return
    if (!boxRef.current) return
    e.preventDefault()
    boxRef.current.setPointerCapture?.(e.pointerId)
    setDrag({
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    })
  }

  function onPointerMove(e) {
    if (!drag) return
    if (e.pointerId !== drag.pointerId) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const next = clampOffset({ x: drag.startOffsetX + dx, y: drag.startOffsetY + dy })
    setOffset(next)
  }

  function onPointerUp(e) {
    if (!drag) return
    if (e.pointerId !== drag.pointerId) return
    setDrag(null)
  }

  async function confirm() {
    if (!file) return
    if (!boxSize.w || !boxSize.h) return
    if (!imgNatural.w || !imgNatural.h) return
    setBusy(true)
    setError(null)
    try {
      const outW = Math.min(outputMaxWidth, 2048)
      const outH = Math.round(outW / Math.max(aspect, 0.0001))
      const cropped = await cropToJpegFile({
        file,
        aspect,
        offsetX: offset.x,
        offsetY: offset.y,
        scale,
        boxW: boxSize.w,
        boxH: boxSize.h,
        outW,
        outH,
      })
      onConfirm?.(cropped)
    } catch (e) {
      setError(e?.message ?? 'Failed to crop image')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="text-sm font-semibold">{title || 'Adjust image'}</div>
            <Button variant="secondary" type="button" onClick={onCancel} disabled={busy}>
              Close
            </Button>
          </div>

          <div className="p-5">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div
                  ref={boxRef}
                  className={[
                    'relative w-full overflow-hidden rounded-2xl border bg-slate-100',
                    drag ? 'cursor-grabbing' : 'cursor-grab',
                  ].join(' ')}
                  style={{ aspectRatio: String(aspect) }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  {objectUrl ? (
                    <img
                      ref={imgRef}
                      src={objectUrl}
                      alt="Crop"
                      draggable={false}
                      onLoad={(e) => {
                        const el = e.currentTarget
                        setImgNatural({ w: el.naturalWidth || 0, h: el.naturalHeight || 0 })
                      }}
                      className="absolute left-1/2 top-1/2 max-w-none select-none"
                      style={{
                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                        transformOrigin: 'center',
                        willChange: 'transform',
                      }}
                    />
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-slate-600">Drag to reposition.</div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-700">Zoom</div>
                  <input
                    className="mt-2 w-full"
                    type="range"
                    min={minScale}
                    max={maxScale}
                    step={(maxScale - minScale) / 200 || 0.001}
                    value={scale}
                    onChange={(e) => {
                      const nextScale = Number(e.target.value)
                      const nextOffset = clampOffset(offset, nextScale)
                      setScale(nextScale)
                      setOffset(nextOffset)
                    }}
                    disabled={busy}
                  />
                </div>

                <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-700">
                  Tip: choose a clear face for profile photos, and a wide “work showcase” photo for cover.
                </div>

                {error ? <div className="text-sm text-red-700">{error}</div> : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={confirm}>
                    {busy ? 'Processing…' : 'Use this photo'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setScale(minScale)
                      setOffset({ x: 0, y: 0 })
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}


