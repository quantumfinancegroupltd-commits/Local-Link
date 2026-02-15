import { Card } from '../ui/FormControls.jsx'

function fmt(n) {
  const x = Number(n ?? 0)
  return Number.isFinite(x) ? x : 0
}

export function SkillEndorsementsCard({ loading, error, data, compact = false }) {
  const skills = Array.isArray(data?.skills) ? data.skills : []
  const totalEndorsers = fmt(data?.total_endorsers)

  return (
    <Card className={compact ? 'p-4' : ''}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Endorsed skills</div>
          <div className="mt-1 text-xs text-slate-600">Only from completed, verified transactions.</div>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-slate-600">Loading…</div>
      ) : error ? (
        <div className="mt-3 text-sm text-red-700">{error}</div>
      ) : skills.length === 0 ? (
        <div className="mt-3 text-sm text-slate-600">No endorsements yet.</div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {skills.slice(0, 10).map((s) => (
              <span key={s.skill} className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {s.skill} • {fmt(s.endorsers)} client{fmt(s.endorsers) === 1 ? '' : 's'}
              </span>
            ))}
          </div>
          {totalEndorsers ? <div className="mt-2 text-xs text-slate-500">{totalEndorsers} total endorser(s)</div> : null}
        </>
      )}
    </Card>
  )
}

