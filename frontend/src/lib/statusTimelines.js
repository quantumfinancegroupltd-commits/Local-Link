function s(x) {
  return String(x ?? '')
    .trim()
    .toLowerCase()
}

function state(done, active) {
  if (done) return 'done'
  if (active) return 'active'
  return 'pending'
}

export function buildEscrowTimeline(escrowStatusRaw) {
  const st = s(escrowStatusRaw)
  const isCancelled = st === 'cancelled'
  const isRefunded = st === 'refunded'
  const isDisputed = st === 'disputed'

  const fundedDone = ['held', 'completed_pending_confirmation', 'released'].includes(st)
  const fundedActive = ['pending_payment', 'not_started'].includes(st) && !fundedDone

  const heldDone = ['held', 'completed_pending_confirmation', 'released'].includes(st)
  const heldActive = st === 'held'

  const workDone = ['completed_pending_confirmation', 'released'].includes(st)
  const workActive = st === 'completed_pending_confirmation'

  const releasedDone = st === 'released'
  const releasedActive = st === 'released'

  const steps = [
    {
      key: 'fund',
      title: 'Fund deposit',
      description: 'Start payment and fund escrow.',
      state: state(fundedDone, fundedActive),
    },
    {
      key: 'held',
      title: 'Held safely',
      description: 'Funds are held until completion/confirmation.',
      state: state(heldDone, heldActive),
    },
    {
      key: 'complete',
      title: 'Work completed',
      description: 'Provider completes the job; buyer confirms.',
      state: state(workDone, workActive),
    },
    {
      key: 'release',
      title: 'Released',
      description: 'Funds paid out (minus platform fee).',
      state: state(releasedDone, releasedActive),
    },
  ]

  if (isCancelled) return { steps, banner: 'Escrow was cancelled.' }
  if (isRefunded) return { steps, banner: 'Escrow was refunded.' }
  if (isDisputed) return { steps, banner: 'Escrow is in dispute — funds are frozen.' }
  return { steps, banner: null }
}

export function buildJobTimeline(jobStatusRaw, escrowStatusRaw) {
  const js = s(jobStatusRaw)
  const es = s(escrowStatusRaw)

  const cancelled = js === 'cancelled'
  const disputed = es === 'disputed'

  const createdDone = ['assigned', 'in_progress', 'completed', 'cancelled'].includes(js) || js === 'open'
  const createdActive = js === 'open'

  const quoteDone = ['assigned', 'in_progress', 'completed', 'cancelled'].includes(js)
  const quoteActive = js === 'assigned'

  const fundedDone = ['held', 'completed_pending_confirmation', 'released'].includes(es)
  const fundedActive = (js === 'assigned' || js === 'in_progress' || js === 'completed') && !fundedDone

  const inProgressDone = ['in_progress', 'completed'].includes(js)
  const inProgressActive = js === 'in_progress'

  const completedDone = js === 'completed'
  const completedActive = js === 'completed'

  const paidDone = es === 'released'
  const paidActive = es === 'released'

  const steps = [
    { key: 'created', title: 'Job posted', description: 'Job is live for quotes.', state: state(createdDone, createdActive) },
    { key: 'quote', title: 'Quote accepted', description: 'Pick a provider and agree price.', state: state(quoteDone, quoteActive) },
    { key: 'fund', title: 'Escrow funded', description: 'Deposit held safely in Trust Wallet.', state: state(fundedDone, fundedActive) },
    { key: 'work', title: 'Work in progress', description: 'Provider is working on the job.', state: state(inProgressDone, inProgressActive) },
    { key: 'done', title: 'Completed', description: 'Provider marked done; confirm if correct.', state: state(completedDone, completedActive) },
    { key: 'paid', title: 'Paid out', description: 'Escrow released to provider.', state: state(paidDone, paidActive) },
  ]

  if (cancelled) return { steps, banner: 'Job was cancelled.' }
  if (disputed) return { steps, banner: 'Job is in dispute — funds are frozen.' }
  return { steps, banner: null }
}

export function buildDeliveryTimeline(deliveryStatusRaw, orderStatusRaw) {
  const ds = s(deliveryStatusRaw)
  const os = s(orderStatusRaw)
  const cancelled = os === 'cancelled' || ds === 'cancelled'

  const placedDone = true
  const placedActive = ds === 'created'

  const assignedDone = ['driver_assigned', 'picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(ds)
  const assignedActive = ds === 'driver_assigned'

  const pickedDone = ['picked_up', 'on_the_way', 'delivered', 'confirmed'].includes(ds)
  const pickedActive = ds === 'picked_up'

  const onWayDone = ['on_the_way', 'delivered', 'confirmed'].includes(ds)
  const onWayActive = ds === 'on_the_way'

  const deliveredDone = ['delivered', 'confirmed'].includes(ds)
  const deliveredActive = ds === 'delivered'

  const confirmedDone = ds === 'confirmed'
  const confirmedActive = ds === 'confirmed'

  const steps = [
    { key: 'placed', title: 'Placed', description: 'Order placed.', state: state(placedDone, placedActive) },
    { key: 'assigned', title: 'Assigned', description: 'Driver assigned.', state: state(assignedDone, assignedActive) },
    { key: 'picked', title: 'Picked up', description: 'Driver picked up.', state: state(pickedDone, pickedActive) },
    { key: 'otw', title: 'On the way', description: 'En route.', state: state(onWayDone, onWayActive) },
    { key: 'delivered', title: 'Delivered', description: 'Marked delivered.', state: state(deliveredDone, deliveredActive) },
    { key: 'confirmed', title: 'Confirmed', description: 'Buyer confirmed.', state: state(confirmedDone, confirmedActive) },
  ]

  if (cancelled) return { steps, banner: 'Order was cancelled.' }
  return { steps, banner: null }
}


