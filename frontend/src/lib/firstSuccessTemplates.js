/**
 * One-tap job templates for buyer "first success" — post first job in under 60 seconds.
 * Used on buyer dashboard ("Need help today?") and pre-fill on /buyer/jobs/new?template=...
 */
export const FIRST_SUCCESS_TEMPLATES = [
  {
    id: 'cleaning',
    label: 'Cleaning',
    title: 'House cleaning',
    description: 'I need cleaning help — one-off or regular. Please include: what to clean (e.g. whole house, kitchen, bathrooms), frequency if recurring, and any access instructions.',
    category: 'Domestic Services',
  },
  {
    id: 'catering',
    label: 'Catering',
    title: 'Catering for event',
    description: 'I need catering for an event. Please include: event date, venue, approximate head count, and what you need (meals, drinks, equipment like chairs/tents if applicable).',
    category: 'Events & Catering',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    title: 'Delivery needed',
    description: 'I need something delivered. Please include: what to deliver, collection address/area, delivery address/area, and when it’s needed.',
    category: 'Other',
  },
  {
    id: 'repairs',
    label: 'Repairs',
    title: 'Repairs or fix',
    description: 'Something needs fixing. Please describe the issue (e.g. leaking tap, broken door, electrical fault) and when you’d like it done.',
    category: 'Other',
  },
]

export function getFirstSuccessTemplate(id) {
  if (!id || typeof id !== 'string') return null
  const slug = id.trim().toLowerCase()
  return FIRST_SUCCESS_TEMPLATES.find((t) => t.id === slug) || null
}
