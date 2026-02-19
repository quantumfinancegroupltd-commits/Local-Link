import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'
import { Button, Card } from '../ui/FormControls.jsx'

export function JobSuggestionsWidget({ className = '' }) {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await http.get('/buyer/job-suggestions')
        if (!cancelled) setSuggestions(Array.isArray(res.data?.suggestions) ? res.data.suggestions : [])
      } catch {
        if (!cancelled) setSuggestions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading || suggestions.length === 0) return null

  const s = suggestions[0]
  const ctaPath = s.cta_path?.startsWith('/') ? s.cta_path : `/buyer/jobs/new`

  return (
    <Card className={`border-emerald-200 bg-emerald-50/50 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Suggested for you</div>
          <p className="mt-1 text-sm text-emerald-900">{s.message}</p>
        </div>
        <Link to={ctaPath} className="shrink-0">
          <Button>{s.cta_label || 'Continue'}</Button>
        </Link>
      </div>
    </Card>
  )
}
