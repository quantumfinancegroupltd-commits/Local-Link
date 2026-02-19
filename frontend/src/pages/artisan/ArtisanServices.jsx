import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { uploadMediaFiles } from '../../api/uploads.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { JOB_CATEGORIES_TIER1 } from '../../lib/jobCategories.js'
import { formatDurationMinutes } from '../../lib/duration.js'

export function ArtisanServices() {
  const toast = useToast()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('GHS')
  const [durationDays, setDurationDays] = useState('')
  const [durationHours, setDurationHours] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [category, setCategory] = useState('')
  const [bundleItemsText, setBundleItemsText] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteBusyId, setDeleteBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const r = await http.get('/artisans/me/services')
      setServices(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to load services')
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setTitle('')
    setDescription('')
    setPrice('')
    setCurrency('GHS')
    setDurationDays('')
    setDurationHours('')
    setDurationMinutes('')
    setCategory('')
    setBundleItemsText('')
    setImageUrl('')
    setImageFile(null)
  }

  function startEdit(s) {
    setEditingId(s.id)
    setFormOpen(true)
    setTitle(s.title ?? '')
    setDescription(s.description ?? '')
    setPrice(String(s.price ?? ''))
    setCurrency(s.currency ?? 'GHS')
    if (s.duration_minutes != null && s.duration_minutes > 0) {
      const total = s.duration_minutes
      const d = Math.floor(total / 1440)
      const h = Math.floor((total % 1440) / 60)
      const m = total % 60
      setDurationDays(d > 0 ? String(d) : '')
      setDurationHours(h > 0 ? String(h) : '')
      setDurationMinutes(m > 0 ? String(m) : (d === 0 && h === 0 ? String(total) : ''))
    } else {
      setDurationDays('')
      setDurationHours('')
      setDurationMinutes('')
    }
    setCategory(s.category ?? '')
    setBundleItemsText(Array.isArray(s.bundle_items) && s.bundle_items.length ? s.bundle_items.join(', ') : '')
    setImageUrl(s.image_url ?? '')
    setImageFile(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const priceNum = parseFloat(String(price).replace(/[^0-9.-]/g, ''))
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error('Enter a valid price')
      return
    }
    const d = parseInt(durationDays, 10) || 0
    const h = parseInt(durationHours, 10) || 0
    const m = parseInt(durationMinutes, 10) || 0
    const totalMinutes = d * 1440 + h * 60 + m
    const durationValue = totalMinutes > 0 ? totalMinutes : null

    let finalImageUrl = imageUrl
    if (imageFile) {
      setUploadBusy(true)
      try {
        const uploaded = await uploadMediaFiles([imageFile])
        finalImageUrl = uploaded?.[0]?.url ?? imageUrl
      } catch {
        toast.error('Image upload failed. Try again.')
        setUploadBusy(false)
        return
      }
      setUploadBusy(false)
    }

    setBusy(true)
    try {
      const bundleItems = bundleItemsText.trim() ? bundleItemsText.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : []
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        price: priceNum,
        currency: currency || 'GHS',
        duration_minutes: durationValue,
        category: category.trim() || null,
        bundle_items: bundleItems.length ? bundleItems : [],
        image_url: finalImageUrl || null,
      }
      if (editingId) {
        await http.patch(`/artisans/me/services/${editingId}`, payload)
        toast.success('Service updated')
      } else {
        await http.post('/artisans/me/services', payload)
        toast.success('Service added')
      }
      resetForm()
      await load()
    } catch (e) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to save'
      const issues = e?.response?.data?.issues
      toast.error(issues?.length ? `${msg}: ${issues.map((i) => i.message).join(', ')}` : msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this service from your profile?')) return
    setDeleteBusyId(id)
    try {
      await http.delete(`/artisans/me/services/${id}`)
      toast.success('Service removed')
      await load()
      if (editingId === id) resetForm()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to delete')
    } finally {
      setDeleteBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        kicker="Profile"
        title="My services"
        subtitle="Productized offerings that appear on your profile. Buyers can book these directly."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/artisan">
              <Button variant="secondary">Back</Button>
            </Link>
            {!formOpen ? (
              <Button onClick={() => setFormOpen(true)}>Add service</Button>
            ) : null}
          </div>
        }
      />

      {formOpen ? (
        <Card>
          <div className="text-sm font-semibold">{editingId ? 'Edit service' : 'Add service'}</div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <Label>Service name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 1-hour plumbing call" required />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's included?" rows={2} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Price</Label>
                <Input type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" required />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="GHS">GHS</option>
                  <option value="USD">USD</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Duration (optional)</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder="0" className="w-20" />
                  <span className="text-sm text-slate-600">days</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={durationHours} onChange={(e) => setDurationHours(e.target.value)} placeholder="0" className="w-20" />
                  <span className="text-sm text-slate-600">hours</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="0" className="w-20" />
                  <span className="text-sm text-slate-600">minutes</span>
                </div>
              </div>
            </div>
            <div>
              <Label>Image (optional)</Label>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                {(imageUrl || imageFile) ? (
                  <div className="relative">
                    {imageFile ? (
                      <img
                        src={URL.createObjectURL(imageFile)}
                        alt="Preview"
                        className="h-24 w-24 rounded-lg border object-cover"
                      />
                    ) : (
                      <img src={imageUrl} alt="Service" className="h-24 w-24 rounded-lg border object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('')
                        setImageFile(null)
                      }}
                      className="absolute -right-2 -top-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      ×
                    </button>
                  </div>
                ) : null}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f && f.type.startsWith('image/')) setImageFile(f)
                      e.target.value = ''
                    }}
                  />
                  <span className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {uploadBusy ? 'Uploading…' : 'Choose image'}
                  </span>
                </label>
              </div>
            </div>
            <div>
              <Label>Bundle items (optional)</Label>
              <Input
                value={bundleItemsText}
                onChange={(e) => setBundleItemsText(e.target.value)}
                placeholder="e.g. 3-room clean, iron, laundry"
              />
              <p className="mt-1 text-xs text-slate-500">List what’s included in this package; shown as “Includes: …” on your profile.</p>
            </div>
            <div>
              <Label>Category (optional)</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                {JOB_CATEGORIES_TIER1.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || uploadBusy || !title.trim()}>
                {editingId ? 'Update' : 'Add'} service
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="text-sm font-semibold">Services on your profile</div>
        {loading ? (
          <div className="mt-4 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="mt-4 text-sm text-red-600">{error}</div>
        ) : services.length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Add productized services so buyers can book directly from your profile."
            actions={
              <Button onClick={() => setFormOpen(true)}>Add your first service</Button>
            }
          />
        ) : (
          <div className="mt-4 space-y-3">
            {services.map((s) => (
              <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-slate-50/50 p-4">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.title} className="h-16 w-16 shrink-0 rounded-lg border object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{s.title}</div>
                  {s.description ? <div className="mt-0.5 text-sm text-slate-600">{s.description}</div> : null}
                  {Array.isArray(s.bundle_items) && s.bundle_items.length > 0 ? (
                    <div className="mt-0.5 text-sm text-slate-600">Includes: {s.bundle_items.join(', ')}</div>
                  ) : null}
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {s.currency} {Number(s.price).toFixed(0)}
                    {(function () { const d = formatDurationMinutes(s.duration_minutes); return d ? ` • ${d}` : ''; })()}
                    {s.category ? ` • ${s.category}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(s)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" disabled={deleteBusyId === s.id} onClick={() => handleDelete(s.id)}>
                    {deleteBusyId === s.id ? '…' : 'Remove'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
