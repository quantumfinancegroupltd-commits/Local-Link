import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { useDraftAutosave } from '../../lib/drafts.js'
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from '../../lib/productCategories.js'

export function FarmerListProduct() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('vegetables')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [mediaFiles, setMediaFiles] = useState([]) // File[]
  const [mediaError, setMediaError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const draftKey = 'draft:farmer:list_product'
  const draftData = useMemo(
    () => ({
      name,
      category,
      quantity,
      unit,
      price,
      imageUrl,
      saved_at: Date.now(),
    }),
    [name, category, quantity, unit, price, imageUrl],
  )
  const draft = useDraftAutosave({ key: draftKey, data: draftData, enabled: true, debounceMs: 700 })

  useEffect(() => {
    const empty = !name && !quantity && !price && !imageUrl
    if (!empty) return
    const d = draft.load()
    if (!d) return
    setName(String(d.name ?? ''))
    setCategory(String(d.category ?? 'vegetables'))
    setQuantity(String(d.quantity ?? ''))
    setUnit(String(d.unit ?? 'kg'))
    setPrice(String(d.price ?? ''))
    setImageUrl(String(d.imageUrl ?? ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previews = useMemo(() => {
    return mediaFiles.map((f) => ({
      name: f.name,
      type: f.type,
      kind: f.type?.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(f),
    }))
  }, [mediaFiles])

  useEffect(() => {
    return () => {
      for (const p of previews) URL.revokeObjectURL(p.url)
    }
  }, [previews])

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMediaError(null)
    setBusy(true)
    try {
      let media = null
      let image_url = imageUrl ? imageUrl : undefined

      if (mediaFiles.length) {
        const uploaded = await uploadMediaFiles(mediaFiles)
        if (!uploaded.length) {
          setMediaError('Upload failed. Please try again.')
          return
        }
        media = uploaded.map((x) => ({ url: x.url, kind: x.kind, mime: x.mime, size: x.size }))
        const firstImage = media.find((m) => m.kind === 'image' && m.url)
        image_url = firstImage?.url ?? image_url
      }

      await http.post('/products', {
        name,
        category,
        quantity: Number(quantity),
        unit,
        price: Number(price),
        image_url,
        media,
      })
      draft.clear()
      navigate('/farmer', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to list product')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        kicker="Marketplace"
        title="List produce or flowers"
        subtitle="Create a simple “Buy Now” listing for the marketplace (produce, flowers, plants)."
        actions={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>Draft autosaves while you type (attachments are not saved).</div>
          <div className="flex items-center gap-2">
            {draft.savedAt ? <span className="text-emerald-700">Saved</span> : <span>Not saved yet</span>}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                draft.clear()
                setName('')
                setCategory('vegetables')
                setQuantity('')
                setUnit('kg')
                setPrice('')
                setImageUrl('')
                setMediaFiles([])
              }}
            >
              Clear draft
            </Button>
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
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
              <Label>Unit</Label>
              <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {PRODUCT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Quantity</Label>
              <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} type="number" min="1" required />
            </div>
            <div>
              <Label>Price (GHS)</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="1" required />
            </div>
          </div>

          <div>
            <Label>Upload media (optional)</Label>
            <Input
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []))}
              disabled={busy}
            />
            <div className="mt-2 text-xs text-slate-500">You can upload multiple images/videos. Max 50MB per file.</div>
            {mediaError ? <div className="mt-2 text-sm text-red-700">{mediaError}</div> : null}
            {previews.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {previews.map((p) => (
                  <div key={`${p.name}-${p.url}`} className="overflow-hidden rounded-xl border bg-white">
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
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/…"
            />
            <div className="mt-2 text-xs text-slate-500">
              Tip: if you don’t upload media files, you can still use an external image URL.
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3">
            <Button disabled={busy}>{busy ? 'Listing…' : 'List product'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


