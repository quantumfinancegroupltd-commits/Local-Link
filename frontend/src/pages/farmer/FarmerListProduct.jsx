import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Select } from '../../components/ui/FormControls.jsx'

export function FarmerListProduct() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('vegetables')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('kg')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await http.post('/products', {
        name,
        category,
        quantity: Number(quantity),
        unit,
        price: Number(price),
        image_url: imageUrl ? imageUrl : undefined,
      })
      navigate('/farmer', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to list product')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <h1 className="text-xl font-bold">List produce</h1>
        <p className="mt-1 text-sm text-slate-600">Create a simple “Buy Now” listing for the marketplace.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label>Product name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="vegetables">Vegetables</option>
                <option value="fruits">Fruits</option>
                <option value="grains">Grains</option>
                <option value="poultry">Poultry</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label>Unit</Label>
              <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="kg">kg</option>
                <option value="crate">crate</option>
                <option value="bunch">bunch</option>
                <option value="bag">bag</option>
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
            <Label>Photo URL (optional)</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/…"
            />
            <div className="mt-2 text-xs text-slate-500">
              Tip: use a royalty-free image URL, or we can add upload support (Supabase Storage) next.
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


