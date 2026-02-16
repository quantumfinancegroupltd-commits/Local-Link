import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Select, Textarea } from '../../components/ui/FormControls.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { useToast } from '../../components/ui/Toast.jsx'
import { JOB_CATEGORIES_TIER1 } from '../../lib/jobCategories.js'

export function ArtisanServices() {
  const navigate = useNavigate()
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
  const [durationMinutes, setDurationMinutes] = useState('')
  const [category, setCategory] = useState('')
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
    setDurationMinutes('')
    setCategory('')
  }

  function startEdit(s) {
    setEditingId(s.id)
    setFormOpen(true)
    setTitle(s.title ?? '')
    setDescription(s.description ?? '')
    setPrice(String(s.price ?? ''))
    setCurrency(s.currency ?? 'GHS')
    setDurationMinutes(s.duration_minutes != null ? String(s.duration_minutes) : '')
    setCategory(s.category ?? '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const priceNum = parseFloat(String(price).replace(/[^0-9.-]/g, ''))
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error('Enter a valid price')
      return
    }
    setBusy(true)
    try {
      if (editingId) {
        await http.patch(`/artisans/me/services/${editingId}`, {
          title: title.trim(),
          description: description.trim() || null,
          price: priceNum,
          currency: currency || 'GHS',
          duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
          category: category.trim() || null,
        })
        toast.success('Service updated')
      } else {
        await http.post('/artisans/me/services', {
          title: title.trim(),
          description: description.trim() || null,
          price: priceNum,
          currency: currency || 'GHS',
          duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
          category: category.trim() || null,
        })
        toast.success('Service added')
      }
      resetForm()
      await load()
    } catch (e) {
      toast.error(e?.response?.data?.message ?? e?.message ?? 'Failed to save')
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Duration (minutes, optional)</Label>
                <Input type="number" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="e.g. 60" />
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
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy || !title.trim()}>
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
                <div>
                  <div className="font-semibold text-slate-900">{s.title}</div>
                  {s.description ? <div className="mt-0.5 text-sm text-slate-600">{s.description}</div> : null}
                  <div className="mt-1 text-sm font-medium text-slate-700">
                    {s.currency} {Number(s.price).toFixed(0)}
                    {s.duration_minutes ? ` • ${s.duration_minutes} min` : ''}
                    {s.category ? ` • ${s.category}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
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
