function normalizeStatus(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function styleFor(status) {
  const s = normalizeStatus(status)

  if (['open', 'created', 'pending', 'pending_payment', 'not_started'].includes(s)) {
    return 'bg-slate-100 text-slate-700'
  }
  if (['assigned', 'driver_assigned', 'held', 'picked_up', 'on_the_way', 'in_progress', 'under_review'].includes(s)) {
    return 'bg-blue-50 text-blue-700 border border-blue-100'
  }
  if (['completed', 'completed_pending_confirmation', 'delivered'].includes(s)) {
    return 'bg-amber-50 text-amber-800 border border-amber-100'
  }
  if (['released', 'confirmed', 'paid'].includes(s)) {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-100'
  }
  if (['cancelled', 'rejected', 'refunded', 'failed', 'disputed'].includes(s)) {
    return 'bg-red-50 text-red-800 border border-red-100'
  }

  return 'bg-slate-100 text-slate-700'
}

export function StatusPill({ status, label }) {
  const text = label ?? (status ? String(status) : '—')
  return (
    <span className={['inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', styleFor(status)].join(' ')}>
      {text}
    </span>
  )
}


