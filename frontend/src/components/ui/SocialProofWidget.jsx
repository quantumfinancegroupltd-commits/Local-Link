import { useEffect, useState } from 'react'
import { http } from '../../api/http.js'

/**
 * Platform stats for social proof: "X jobs completed this week", "Trusted by Y users".
 * Fetches GET /api/stats (public). Renders compact line or small cards.
 */
export function SocialProofWidget({ variant = 'inline', className = '' }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    http.get('/stats')
      .then((res) => {
        if (!cancelled && res.data) setStats(res.data)
      })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading || !stats) return null

  const jobs = Number(stats.jobs_completed_7d ?? 0)
  const users = Number(stats.users_count ?? 0)
  if (jobs === 0 && users === 0) return null

  if (variant === 'cards') {
    return (
      <div className={`flex flex-wrap gap-3 ${className}`}>
        {jobs > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-center">
            <div className="text-lg font-bold text-slate-900">{jobs.toLocaleString()}</div>
            <div className="text-xs text-slate-600">jobs completed this week</div>
          </div>
        ) : null}
        {users > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-center">
            <div className="text-lg font-bold text-slate-900">{users.toLocaleString()}</div>
            <div className="text-xs text-slate-600">trusted users</div>
          </div>
        ) : null}
      </div>
    )
  }

  // inline: single line
  const parts = []
  if (jobs > 0) parts.push(`${jobs.toLocaleString()} jobs completed this week`)
  if (users > 0) parts.push(`Trusted by ${users.toLocaleString()} users`)
  if (parts.length === 0) return null

  return (
    <p className={`text-sm text-slate-600 ${className}`}>
      {parts.join(' • ')}
    </p>
  )
}
