import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { StarRating } from '../../components/reviews/StarRating.jsx'
import { Button, Card, Label, Textarea } from '../../components/ui/FormControls.jsx'

export function LeaveReview() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const kind = params.get('kind') // job | order
  const id = params.get('id')
  const target = params.get('target') // artisan | farmer | driver

  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(true)
  const [eligibility, setEligibility] = useState(null)

  const [done, setDone] = useState(false)
  const [suggestions, setSuggestions] = useState([]) // skills
  const [selected, setSelected] = useState([])
  const [endorseBusy, setEndorseBusy] = useState(false)
  const [endorseError, setEndorseError] = useState(null)

  const title = useMemo(() => {
    if (kind === 'job') return 'Review artisan'
    if (kind === 'order') return `Review ${target || 'seller'}`
    return 'Leave review'
  }, [kind, target])

  useEffect(() => {
    let cancelled = false
    async function loadEligibility() {
      setEligibilityLoading(true)
      setEligibility(null)
      setError(null)
      try {
        if (!kind || !id) throw new Error('Missing review context')
        if (kind === 'job') {
          const r = await http.get(`/reviews/jobs/${encodeURIComponent(id)}/eligibility`)
          if (!cancelled) setEligibility(r.data ?? null)
          return
        }
        if (kind === 'order') {
          if (!target) throw new Error('Missing target')
          const r = await http.get(`/reviews/orders/${encodeURIComponent(id)}/eligibility`, { params: { target } })
          if (!cancelled) setEligibility(r.data ?? null)
          return
        }
        throw new Error('Invalid review context')
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load review eligibility')
      } finally {
        if (!cancelled) setEligibilityLoading(false)
      }
    }
    loadEligibility()
    return () => {
      cancelled = true
    }
  }, [kind, id, target])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (!kind || !id) throw new Error('Missing review context')
      if (eligibilityLoading) throw new Error('Checking eligibility…')
      if (eligibility?.eligible === false) {
        throw new Error(eligibility?.reason ?? 'Review not available yet.')
      }
      if (kind === 'job') {
        await http.post(`/reviews/jobs/${id}`, { rating, comment })
        // Optional: endorse skills (transaction-backed) to build professional memory.
        const targetUserId = eligibility?.target_user_id
        if (targetUserId) {
          try {
            const p = await http.get(`/profile/${encodeURIComponent(targetUserId)}`)
            const rp = p.data?.role_profile ?? null
            const skills = Array.isArray(rp?.skills) ? rp.skills.filter(Boolean) : []
            const primary = rp?.primary_skill ? [String(rp.primary_skill)] : []
            const merged = Array.from(new Set([...primary, ...skills].map((s) => String(s).trim()).filter(Boolean))).slice(0, 12)
            setSuggestions(merged)
          } catch {
            setSuggestions([])
          }
        }
        setDone(true)
        return
      }
      if (kind === 'order') {
        if (!target || !['farmer', 'driver'].includes(target)) throw new Error('Missing target')
        await http.post(`/reviews/orders/${id}`, { target, rating, comment })
        navigate('/buyer/orders', { replace: true })
        return
      }
      throw new Error('Invalid review context')
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to submit review')
    } finally {
      setBusy(false)
    }
  }

  async function submitEndorsements() {
    if (!id) return
    if (!selected.length) return navigate(`/buyer/jobs/${id}`, { replace: true })
    setEndorseBusy(true)
    setEndorseError(null)
    try {
      await http.post(`/endorsements/jobs/${encodeURIComponent(id)}`, { skills: selected })
      navigate(`/buyer/jobs/${id}`, { replace: true })
    } catch (e) {
      setEndorseError(e?.response?.data?.message ?? e?.message ?? 'Failed to submit endorsements')
    } finally {
      setEndorseBusy(false)
    }
  }

  function toggleSkill(skill) {
    const s = String(skill || '').trim()
    if (!s) return
    setSelected((arr) => {
      const has = arr.includes(s)
      if (has) return arr.filter((x) => x !== s)
      if (arr.length >= 3) return arr
      return [...arr, s]
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="text-xs text-slate-500">
            {kind?.toUpperCase()} • {id?.slice(0, 8)}
          </div>
        </div>
        <Link to="/buyer">
          <Button variant="secondary">Back</Button>
        </Link>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          {eligibilityLoading ? (
            <div className="text-sm text-slate-600">Checking eligibility…</div>
          ) : eligibility?.eligible === false ? (
            <div className={eligibility?.already_reviewed ? 'text-sm text-emerald-700' : 'text-sm text-amber-800'}>
              {eligibility?.already_reviewed ? 'Already reviewed.' : 'Not available yet.'}{' '}
              <span className="text-slate-700">{eligibility?.reason ?? ''}</span>
            </div>
          ) : null}

          {done && kind === 'job' ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                Review submitted. Thank you.
              </div>
              {suggestions.length ? (
                <div>
                  <div className="text-sm font-semibold text-slate-900">Endorse skills (optional)</div>
                  <div className="mt-1 text-xs text-slate-600">Choose up to 3. Only counted because this was a completed transaction.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestions.map((s) => {
                      const on = selected.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSkill(s)}
                          className={[
                            'rounded-full border px-3 py-1 text-xs font-semibold',
                            on ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                          ].join(' ')}
                          title={selected.length >= 3 && !on ? 'Select up to 3' : undefined}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-600">No skill suggestions available for this profile yet.</div>
              )}
              {endorseError ? <div className="text-sm text-red-700">{endorseError}</div> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={submitEndorsements} disabled={endorseBusy}>
                  {endorseBusy ? 'Saving…' : selected.length ? 'Endorse selected' : 'Finish'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate(`/buyer/jobs/${id}`, { replace: true })} disabled={endorseBusy}>
                  Skip
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label>Rating</Label>
                <StarRating value={rating} onChange={setRating} disabled={busy || eligibilityLoading || eligibility?.eligible === false} />
              </div>
              <div>
                <Label>Comment (optional)</Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="What went well? What can improve?"
                  disabled={busy || eligibilityLoading || eligibility?.eligible === false}
                />
              </div>
              {error ? <div className="text-sm text-red-700">{error}</div> : null}
              <div className="flex gap-2">
                <Button disabled={busy || eligibilityLoading || eligibility?.eligible === false}>
                  {eligibility?.already_reviewed ? 'Reviewed' : busy ? 'Submitting…' : 'Submit review'}
                </Button>
              </div>
            </>
          )}
        </form>
      </Card>
    </div>
  )
}


