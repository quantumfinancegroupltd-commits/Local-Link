import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Textarea } from '../../components/ui/FormControls.jsx'

export function BuyerPostJob() {
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [budget, setBudget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await http.post('/jobs', {
        title,
        description,
        location,
        budget: budget ? Number(budget) : null,
      })
      const jobId = res.data?.id ?? res.data?.job?.id
      navigate(jobId ? `/buyer/jobs/${jobId}` : '/buyer', { replace: true })
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to post job')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <h1 className="text-xl font-bold">Post a job</h1>
        <p className="mt-1 text-sm text-slate-600">Describe what you need done and where.</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <Label>Job title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
            <div>
              <Label>Budget (optional)</Label>
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} type="number" min="0" placeholder="GHS" />
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3">
            <Button disabled={busy}>{busy ? 'Posting…' : 'Post job'}</Button>
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


