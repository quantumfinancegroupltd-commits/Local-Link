/**
 * Format total minutes into human-readable string.
 * Hierarchy: years > months > weeks > days > hours > minutes.
 */
const MIN_PER_HOUR = 60
const MIN_PER_DAY = 24 * MIN_PER_HOUR
const MIN_PER_WEEK = 7 * MIN_PER_DAY
const MIN_PER_MONTH = 30 * MIN_PER_DAY
const MIN_PER_YEAR = 365 * MIN_PER_DAY

export function formatDurationMinutes(totalMinutes) {
  const m = Math.round(Number(totalMinutes) || 0)
  if (m <= 0) return null

  let rem = m
  const parts = []

  const years = Math.floor(rem / MIN_PER_YEAR)
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
    rem -= years * MIN_PER_YEAR
  }

  const months = Math.floor(rem / MIN_PER_MONTH)
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
    rem -= months * MIN_PER_MONTH
  }

  const weeks = Math.floor(rem / MIN_PER_WEEK)
  if (weeks > 0) {
    parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`)
    rem -= weeks * MIN_PER_WEEK
  }

  const days = Math.floor(rem / MIN_PER_DAY)
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
    rem -= days * MIN_PER_DAY
  }

  const hours = Math.floor(rem / MIN_PER_HOUR)
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
    rem -= hours * MIN_PER_HOUR
  }

  if (rem > 0) {
    parts.push(`${rem} ${rem === 1 ? 'minute' : 'minutes'}`)
  }

  return parts.join(' ')
}
