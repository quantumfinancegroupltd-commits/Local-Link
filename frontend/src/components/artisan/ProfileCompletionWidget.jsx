import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../ui/FormControls.jsx'

function hasSkills(profile) {
  const primary = profile?.primary_skill ?? ''
  if (String(primary).trim()) return true
  const skills = Array.isArray(profile?.skills) ? profile.skills : []
  return skills.filter(Boolean).length > 0
}

function hasJobCategories(profile) {
  const cats = Array.isArray(profile?.job_categories) ? profile.job_categories : []
  return cats.filter(Boolean).length > 0
}

function hasExperience(profile) {
  const y = profile?.experience_years
  return y != null && (typeof y === 'number' ? y >= 0 : true)
}

function hasServiceArea(profile) {
  const area = profile?.service_area ?? ''
  return String(area).trim().length > 0
}

const CHECKS = [
  { key: 'skills', label: 'Skills or primary skill', fn: hasSkills },
  { key: 'job_categories', label: 'Service categories', fn: hasJobCategories },
  { key: 'experience', label: 'Experience', fn: hasExperience },
  { key: 'service_area', label: 'Service area', fn: hasServiceArea },
]

export function ProfileCompletionWidget({ artisanProfile, className = '' }) {
  const { score, total, completed, missing } = useMemo(() => {
    const completedList = CHECKS.filter((c) => c.fn(artisanProfile))
    const missingList = CHECKS.filter((c) => !c.fn(artisanProfile))
    return {
      score: completedList.length,
      total: CHECKS.length,
      completed: completedList,
      missing: missingList,
    }
  }, [artisanProfile])

  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const isComplete = pct >= 100

  if (!artisanProfile) return null

  return (
    <Card className={`border-slate-200 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Profile completion</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pct}%</span>
            {!isComplete && missing.length > 0 ? (
              <span className="text-sm text-slate-600">— add {missing[0].label.toLowerCase()} to get more matches</span>
            ) : null}
          </div>
          <div className="mt-2 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <Link to="/profile" className="shrink-0 text-sm font-medium text-emerald-700 hover:underline">
          {isComplete ? 'View profile' : 'Complete profile'}
        </Link>
      </div>
    </Card>
  )
}
