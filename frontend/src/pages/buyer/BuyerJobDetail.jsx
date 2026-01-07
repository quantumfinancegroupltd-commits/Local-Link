import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function BuyerJobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyQuoteId, setBusyQuoteId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [jobRes, quotesRes] = await Promise.all([
          http.get(`/jobs/${id}`),
          http.get(`/jobs/${id}/quotes`).catch(() => ({ data: [] })),
        ])
        if (cancelled) return
        setJob(jobRes.data?.job ?? jobRes.data ?? null)
        setQuotes(Array.isArray(quotesRes.data) ? quotesRes.data : quotesRes.data?.quotes ?? [])
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

  async function acceptQuote(quoteId) {
    setBusyQuoteId(quoteId)
    try {
      await http.put(`/quotes/${quoteId}`, { status: 'accepted' })
      // Reload quotes
      const quotesRes = await http.get(`/jobs/${id}/quotes`)
      setQuotes(Array.isArray(quotesRes.data) ? quotesRes.data : quotesRes.data?.quotes ?? [])
    } finally {
      setBusyQuoteId(null)
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">{job?.title || 'Job'}</h1>
                <div className="mt-1 text-sm text-slate-600">{job?.location || '—'}</div>
              </div>
              <div className="text-xs font-medium text-slate-700">{job?.status || 'open'}</div>
            </div>
            <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">{job?.description || '—'}</div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Escrow protection (coming next)</div>
            <div className="mt-2 text-sm text-slate-600">
              In the ELITE version, you’ll pay a deposit into a LocalLink Trust Wallet. Funds are held until you confirm
              milestone/completion — reducing fraud for both sides.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/buyer/jobs/${id}/escrow`}>
                <Button variant="secondary">Open Trust Wallet</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <div className="text-sm font-semibold">Quotes</div>
            {quotes.length === 0 ? (
              <div className="mt-3 text-sm text-slate-600">No quotes yet.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {quotes.map((q) => (
                  <div key={q.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold">
                        GHS {q.quote_amount ?? q.quoteAmount ?? '—'}
                      </div>
                      <div className="text-xs font-medium text-slate-700">{q.status || 'pending'}</div>
                    </div>
                    {q.message && <div className="mt-2 text-sm text-slate-700">{q.message}</div>}
                    <div className="mt-3">
                      <Button
                        disabled={busyQuoteId === q.id || q.status === 'accepted'}
                        onClick={() => acceptQuote(q.id)}
                      >
                        {q.status === 'accepted'
                          ? 'Accepted'
                          : busyQuoteId === q.id
                            ? 'Accepting…'
                            : 'Accept quote'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


