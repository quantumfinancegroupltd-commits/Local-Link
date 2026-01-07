import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card, Input, Label, Textarea } from '../../components/ui/FormControls.jsx'

export function ArtisanJobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [quoteAmount, setQuoteAmount] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await http.get(`/jobs/${id}`)
        if (!cancelled) setJob(res.data?.job ?? res.data ?? null)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load job')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function submitQuote(e) {
    e.preventDefault()
    setSubmitError(null)
    setBusy(true)
    try {
      await http.post(`/jobs/${id}/quote`, {
        quote_amount: Number(quoteAmount),
        message,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err?.response?.data?.message ?? err?.message ?? 'Failed to submit quote')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <Card>Loading…</Card>
      ) : error ? (
        <Card>
          <div className="text-sm text-red-700">{error}</div>
        </Card>
      ) : (
        <>
          <Card>
            <h1 className="text-xl font-bold">{job?.title || 'Job'}</h1>
            <div className="mt-1 text-sm text-slate-600">{job?.location || '—'}</div>
            <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{job?.description || '—'}</div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Submit a quote</div>
            {submitted ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Quote submitted. You can track it in the next Phase of the MVP.
              </div>
            ) : (
              <form onSubmit={submitQuote} className="mt-4 space-y-4">
                <div>
                  <Label>Quote amount (GHS)</Label>
                  <Input
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                    type="number"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <Label>Message (optional)</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
                </div>

                {submitError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <Button disabled={busy}>{busy ? 'Submitting…' : 'Submit quote'}</Button>
              </form>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


