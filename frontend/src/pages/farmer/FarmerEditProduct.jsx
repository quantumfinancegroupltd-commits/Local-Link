import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '../../lib/productCategories.js'

function normalizeMedia(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((m) => ({
      url: m?.url,
      kind: m?.kind === 'video' ? 'video' : 'image',
      mime: m?.mime,
      size: m?.size,
    }))
    .filter((m) => typeof m.url === 'string' && m.url.trim())
}

export function FarmerEditProduct() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('vegetables')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [price, setPrice] = useState('')
  const [status, setStatus] = useState('available')
  const [imageUrl, setImageUrl] = useState('')

  const [existingMedia, setExistingMedia] = useState([]) // [{url,kind,mime,size}]
  const [removedUrls, setRemovedUrls] = useState(() => new Set())

  const [newMediaFiles, setNewMediaFiles] = useState([]) // File[]
  const [mediaError, setMediaError] = useState(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await http.get(`/products/${id}`)
        const p = res.data?.product ?? res.data ?? null
        if (!p) throw new Error('Product not found')
        if (cancelled) return

        setName(p.name ?? '')
        setCategory(p.category ?? 'vegetables')
        setQuantity(String(p.quantity ?? ''))
        setUnit(p.unit ?? 'kg')
        setPrice(String(p.price ?? ''))
        setStatus(p.status ?? 'available')
        setImageUrl(p.image_url ?? '')
        setExistingMedia(normalizeMedia(p.media))
        setRemovedUrls(new Set())
      } catch (e) {
        if (!cancelled) setLoadError(e?.response?.data?.message ?? e?.message ?? 'Failed to load product')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const newPreviews = useMemo(() => {
    return newMediaFiles.map((f) => ({
      name: f.name,
      kind: f.type?.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(f),
    }))
  }, [newMediaFiles])

  useEffect(() => {
    return () => {
      for (const p of newPreviews) URL.revokeObjectURL(p.url)
    }
  }, [newPreviews])

  const remainingExisting = useMemo(() => {
    return existingMedia.filter((m) => !removedUrls.has(m.url))
  }, [existingMedia, removedUrls])

  async function onSave(e) {
    e.preventDefault()
    setError(null)
    setMediaError(null)
    setBusy(true)
    try {
      let mergedMedia = remainingExisting

      if (newMediaFiles.length) {
        let uploaded
        try {
          uploaded = await uploadMediaFiles(newMediaFiles)
        } catch (uploadErr) {
          setMediaError(uploadErr?.response?.data?.message ?? uploadErr?.message ?? 'Upload failed. Please try again.')
          return
        }
        if (!uploaded.length) {
          setMediaError('Upload failed. Please try again.')
          return
        }
        const added = uploaded.map((x) => ({ url: x.url, kind: x.kind, mime: x.mime, size: x.size }))
        mergedMedia = [...mergedMedia, ...added]
      }

      // Choose a representative image for cards/fallback
      const firstImage = mergedMedia.find((m) => m.kind === 'image' && m.url)
      const nextImageUrl = firstImage?.url ?? (imageUrl?.trim() ? imageUrl.trim() : null)

      await http.put(`/products/${id}`, {
        name,
        category,
        quantity: Number(quantity),
        unit,
        price: Number(price),
        status,
        image_url: nextImageUrl,
        media: mergedMedia.length ? mergedMedia : null,
      })

      navigate('/farmer', { replace: true })
    } catch (e2) {
      setError(e2?.response?.data?.message ?? e2?.message ?? 'Failed to save changes')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete() {
    const ok = window.confirm('Delete this listing? It will be hidden from the marketplace.')
    if (!ok) return
    setDeleteBusy(true)
    setError(null)
    try {
      await http.delete(`/products/${id}`)
      navigate('/farmer', { replace: true })
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete listing')
    } finally {
      setDeleteBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        kicker="Marketplace"
        title="Edit listing"
        subtitle="Update price/quantity and manage media."
        actions={
          <Button variant="secondary" onClick={() => navigate(-1)} disabled={busy || deleteBusy}>
            Back
          </Button>
        }
      />
      <Card>
        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Loading…</div>
        ) : loadError ? (
          <div className="mt-4 text-sm text-red-700">{loadError}</div>
        ) : (
          <form onSubmit={onSave} className="mt-5 space-y-4">
            <div>
              <Label>Product name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="available">available</option>
                  <option value="sold">sold</option>
                  <option value="pending">pending</option>
                  <option value="cancelled">cancelled</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label>Quantity</Label>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="1" required />
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Price (GHS)</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="1" required />
              </div>
            </div>

            <div>
              <Label>Existing media</Label>
              {remainingExisting.length ? (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {remainingExisting.map((m) => (
                    <div key={m.url} className="overflow-hidden rounded-xl border bg-white">
                      {m.kind === 'video' ? (
                        <video src={m.url} controls className="h-48 w-full object-cover" />
                      ) : (
                        <img src={m.url} alt="media" className="h-48 w-full object-cover" loading="lazy" />
                      )}
                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="truncate text-xs text-slate-600">{m.kind}</div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setRemovedUrls((s) => new Set([...Array.from(s), m.url]))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">No media yet.</div>
              )}
              {removedUrls.size ? (
                <div className="mt-2 text-xs text-slate-500">
                  {removedUrls.size} item(s) will be removed when you save.
                </div>
              ) : null}
            </div>

            <div>
              <Label>Add more media (optional)</Label>
              <Input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => setNewMediaFiles(Array.from(e.target.files ?? []))}
                disabled={busy}
              />
              {mediaError ? <div className="mt-2 text-sm text-red-700">{mediaError}</div> : null}
              {newPreviews.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {newPreviews.map((p) => (
                    <div key={p.url} className="overflow-hidden rounded-xl border bg-white">
                      {p.kind === 'video' ? (
                        <video src={p.url} controls className="h-48 w-full object-cover" />
                      ) : (
                        <img src={p.url} alt={p.name} className="h-48 w-full object-cover" loading="lazy" />
                      )}
                      <div className="px-3 py-2 text-xs text-slate-600">{p.name}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <Label>Photo URL (optional fallback)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://images.unsplash.com/…" />
              <div className="mt-2 text-xs text-slate-500">
                Used only if there are no uploaded images (or as a fallback).
              </div>
            </div>

            {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <div className="flex flex-wrap gap-3">
              <Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
              <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={busy}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" onClick={onDelete} disabled={busy || deleteBusy} title="Hides listing from the marketplace">
                {deleteBusy ? 'Deleting…' : 'Delete listing'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}


