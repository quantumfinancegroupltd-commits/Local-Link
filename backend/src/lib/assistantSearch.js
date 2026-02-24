/**
 * Search products and providers for the AI assistant so it can suggest real listings.
 * Used only by the assistant route; does not require auth.
 */
import { pool } from '../db/pool.js'

const DEFAULT_LIMIT = 8

function escapeLike(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/**
 * Extract search keywords from a natural language message (e.g. "I need some tomatoes" -> ["tomatoes"]).
 * Drops very short words and common stopwords so we match product names.
 */
/** Common typos so "cleanning" still finds cleaning services. */
const TYPO_FIX = new Map([
  ['cleanning', 'cleaning'],
  ['cleaning', 'cleaning'],
  ['plumbling', 'plumbing'],
  ['electrial', 'electrical'],
])

function extractSearchWords(q) {
  const stop = new Set([
    'i', 'me', 'my', 'am', 'is', 'are', 'need', 'want', 'looking', 'for', 'some', 'the', 'a', 'an', 'to', 'get', 'buy', 'find', 'hire', 'available', 'please', 'in', 'at', 'near', 'around', 'services', 'service',
    'what', 'have', 'you', 'can', 'show', 'there', 'someone', 'who', 'specializes', 'specialist', 'does', 'that', 'options', 'deal', 'with',
  ])
  let words = String(q)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((w) => w.length >= 2 && !stop.has(w))
  words = words.map((w) => TYPO_FIX.get(w) ?? w)
  return words.length ? words : [q.trim().toLowerCase()]
}

/** Ghana location words: use only for filtering by service_area, not for matching service title/category (so "cleaning in Accra" returns only cleaning, not every service in Accra). */
const LOCATION_WORDS = new Set([
  'accra', 'kumasi', 'tema', 'spintex', 'dodowa', 'legon', 'osu', 'cantonments', 'ghana',
])

function splitWordsForServiceSearch(words) {
  const locationWords = words.filter((w) => LOCATION_WORDS.has(w))
  const serviceTypeWords = words.filter((w) => !LOCATION_WORDS.has(w))
  return { serviceTypeWords, locationWords }
}

/** Expand service-type terms so "cleaner" finds cleaning, "plasterer" finds plastering, etc. */
const SERVICE_STEM_EXPAND = new Map([
  ['cleaning', ['cleaning', 'clean', 'laundry', 'ironing']],
  ['clean', ['cleaning', 'clean', 'laundry', 'ironing']],
  ['cleaner', ['cleaning', 'clean', 'laundry', 'ironing']],
  ['cleaners', ['cleaning', 'clean', 'laundry', 'ironing']],
  ['plumbing', ['plumbing', 'plumber']],
  ['plumber', ['plumbing', 'plumber']],
  ['plumbers', ['plumbing', 'plumber']],
  ['blockage', ['blockage', 'clearance']],
  ['clearance', ['blockage', 'clearance']],
  ['electrical', ['electrical', 'electric', 'electrician']],
  ['electric', ['electrical', 'electric', 'electrician']],
  ['electrician', ['electrical', 'electric', 'electrician']],
  ['electricians', ['electrical', 'electric', 'electrician']],
  ['plastering', ['plastering', 'plaster']],
  ['plasterer', ['plastering', 'plaster']],
  ['plasterers', ['plastering', 'plaster']],
  ['plaster', ['plastering', 'plaster']],
  ['tiling', ['tiling', 'tile']],
  ['tile', ['tiling', 'tile']],
  ['catering', ['catering', 'caterer', 'platters', 'food']],
  ['caterer', ['catering', 'caterer', 'platters', 'food']],
  ['caterers', ['catering', 'caterer', 'platters', 'food']],
  ['laundry', ['laundry', 'ironing']],
  ['ironing', ['laundry', 'ironing']],
])

function expandServiceTypeWords(words) {
  const seen = new Set()
  const out = []
  for (const w of words) {
    const expanded = SERVICE_STEM_EXPAND.get(w) ?? [w]
    for (const term of expanded) {
      if (!seen.has(term)) {
        seen.add(term)
        out.push(term)
      }
    }
  }
  return out.length ? out : words
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build a single regex param for word-boundary match (so "clean" doesn't match "clearance"). PostgreSQL uses \\m and \\M for word boundaries. */
function buildServiceRegexWordBoundary(expandedWords, paramOffset = 1) {
  const pattern = '\\m(' + expandedWords.map(escapeRegex).join('|') + ')\\M'
  // Match only title+category when description would pull in wrong results (e.g. "clearance" in "safety clearance" for electrical work)
  const laundryOnly = expandedWords.length === 2 && expandedWords.every((w) => ['laundry', 'ironing'].includes(w))
  const blockageOnly = expandedWords.length <= 2 && expandedWords.every((w) => ['blockage', 'clearance'].includes(w))
  const titleCategoryOnly = laundryOnly || blockageOnly
  const sql = titleCategoryOnly
    ? `(s.title ~* $${paramOffset} or s.category ~* $${paramOffset})`
    : `(s.title ~* $${paramOffset} or s.category ~* $${paramOffset} or coalesce(s.description, '') ~* $${paramOffset})`
  return { sql, params: [pattern] }
}

/**
 * Build SQL ILIKE conditions for any word matching: (col ilike %w1% or col ilike %w2% ...).
 * One param per condition so we can bind each pattern.
 * @param {number} paramOffset - Optional 1-based start index for $N (so two conditions can share one param list)
 */
function buildWordConditions(columnNames, words, paramOffset = 1) {
  const escaped = words.map((w) => `%${escapeLike(w)}%`)
  const params = columnNames.flatMap(() => escaped)
  const conds = params.map((_, i) => `${columnNames[Math.floor(i / escaped.length)]} ilike $${paramOffset + i}`)
  return { sql: '(' + conds.join(' or ') + ')', params }
}

const JOBS_LIMIT = 6

function buildJobConditions(words) {
  const escaped = words.map((w) => `%${escapeLike(w)}%`)
  const conds = escaped.map((_, i) =>
    `(jp.title ilike $${i + 1} or jp.description ilike $${i + 1} or jp.location ilike $${i + 1} or c.name ilike $${i + 1} or array_to_string(coalesce(jp.tags, array[]::text[]), ' ') ilike $${i + 1})`,
  )
  return { sql: '(' + conds.join(' or ') + ')', params: escaped }
}

/**
 * Search products (marketplace), providers (artisans), and job posts (employers) by text.
 * @param {string} q - Search query (e.g. "I need tomatoes", "plumber in Accra")
 * @param {{ productsLimit?: number, providersLimit?: number }} opts
 * @returns {{ products: Array<{id, name, category, price, unit, farmer_name, farmer_user_id}>, providers: Array<{user_id, name, verification_tier, service_area}> }}
 */
const SERVICES_LIMIT = 8

export async function searchForAssistant(q, opts = {}) {
  const raw = String(q).trim()
  if (!raw || raw.length < 1) return { products: [], providers: [], services: [], jobs: [] }

  const words = extractSearchWords(raw)
  const { serviceTypeWords, locationWords } = splitWordsForServiceSearch(words)
  const productsLimit = opts.productsLimit ?? DEFAULT_LIMIT
  const providersLimit = opts.providersLimit ?? 5
  const servicesLimit = opts.servicesLimit ?? SERVICES_LIMIT
  const jobsLimit = opts.jobsLimit ?? JOBS_LIMIT

  const productWords = serviceTypeWords.length > 0 ? serviceTypeWords : words
  const productCond = buildWordConditions(['p.name', 'p.category'], productWords)
  // Jobs keep all words (location is relevant for job search)
  const jobCond = buildJobConditions(words)
  // Match artisans by profile (name, service_area, primary_skill) OR by any of their listed services (title, category, description)
  const providerProfileCond = buildWordConditions(['u.name', 'a.service_area', 'a.primary_skill'], words, 1)
  const profileParamCount = providerProfileCond.params.length
  const providerServiceCond = buildWordConditions(['s.title', 's.category', 'coalesce(s.description, \'\')'], words, profileParamCount + 1)
  // Standalone service search: match only on service-type words (e.g. "cleaning"), with stem expansion and word boundaries so "clean" doesn't match "clearance". Filter location by service_area.
  const hasServiceTypeWords = serviceTypeWords.length > 0
  const expandedServiceWords = expandServiceTypeWords(serviceTypeWords)
  const serviceRegexCond = hasServiceTypeWords ? buildServiceRegexWordBoundary(expandedServiceWords, 1) : null
  const locationCond =
    hasServiceTypeWords && serviceRegexCond && locationWords.length > 0
      ? '(' + locationWords.map((_, i) => `a.service_area ilike $${1 + serviceRegexCond.params.length + i}`).join(' or ') + ')'
      : null
  const serviceLocationParams = locationWords.map((w) => `%${escapeLike(w)}%`)

  let products = []
  let providers = []
  let services = []
  let jobs = []

  try {
    const productRows = await pool.query(
      `select p.id, p.name, p.category, p.quantity, p.unit, p.price, p.image_url,
              f.farm_location,
              u.id as farmer_user_id, u.name as farmer_name
       from products p
       left join farmers f on f.id = p.farmer_id
       left join users u on u.id = f.user_id and u.deleted_at is null
         and (u.suspended_until is null or u.suspended_until <= now())
       where p.status = 'available'
         and (p.quantity is null or p.quantity > 0)
         and ${productCond.sql}
       order by p.created_at desc
       limit $${productCond.params.length + 1}`,
      [...productCond.params, productsLimit],
    )
    products = productRows.rows
  } catch {
    // ignore
  }

  try {
    const providerRows = await pool.query(
      `select distinct on (u.id) u.id as user_id, u.name,
              coalesce(v.level, 'unverified') as verification_tier,
              a.service_area
       from users u
       join artisans a on a.user_id = u.id
       left join verification_levels v on v.user_id = u.id
       left join artisan_services s on s.artisan_user_id = u.id
       where u.deleted_at is null
         and (u.suspended_until is null or u.suspended_until <= now())
         and (${providerProfileCond.sql} or (s.id is not null and ${providerServiceCond.sql}))
       order by u.id, a.premium desc nulls last, u.created_at desc
       limit $${profileParamCount + providerServiceCond.params.length + 1}`,
      [...providerProfileCond.params, ...providerServiceCond.params, providersLimit],
    )
    providers = providerRows.rows
  } catch {
    // ignore
  }

  if (hasServiceTypeWords && serviceRegexCond) {
    try {
      const serviceWhere = locationCond ? `${serviceRegexCond.sql} and ${locationCond}` : serviceRegexCond.sql
      const serviceParamCount = serviceRegexCond.params.length + serviceLocationParams.length
      const serviceRows = await pool.query(
        `select s.id, s.artisan_user_id, s.title, s.description, s.price, s.currency,
                s.duration_minutes, s.category, s.image_url,
                u.name as artisan_name,
                a.service_area,
                coalesce(v.level, 'unverified') as verification_tier
         from artisan_services s
         join users u on u.id = s.artisan_user_id and u.deleted_at is null
           and (u.suspended_until is null or u.suspended_until <= now())
         left join artisans a on a.user_id = u.id
         left join verification_levels v on v.user_id = u.id
         where ${serviceWhere}
         order by s.sort_order asc, s.created_at desc
         limit $${serviceParamCount + 1}`,
        [...serviceRegexCond.params, ...serviceLocationParams, servicesLimit],
      )
      services = serviceRows.rows
    } catch {
      // ignore
    }
  }

  try {
    const jobRows = await pool.query(
      `select jp.id, jp.title, jp.location, jp.employment_type, jp.work_mode,
              jp.pay_min, jp.pay_max, jp.currency, jp.pay_period, jp.image_url,
              c.name as company_name, c.slug as company_slug
       from job_posts jp
       join companies c on c.id = jp.company_id
       join users u on u.id = c.owner_user_id and u.deleted_at is null
       where jp.status = 'open'
         and ${jobCond.sql}
       order by jp.created_at desc
       limit $${jobCond.params.length + 1}`,
      [...jobCond.params, jobsLimit],
    )
    jobs = jobRows.rows
  } catch {
    // ignore
  }

  // When user clearly asks for jobs (e.g. "What jobs do you have?") but word match returned none, show recent open jobs
  const jobIntent = /\b(jobs?|vacancies|roles|hiring|positions|openings|work|employers)\b/.test(raw.toLowerCase())
  if (jobs.length === 0 && jobIntent) {
    try {
      const fallbackJobRows = await pool.query(
        `select jp.id, jp.title, jp.location, jp.employment_type, jp.work_mode,
                jp.pay_min, jp.pay_max, jp.currency, jp.pay_period, jp.image_url,
                c.name as company_name, c.slug as company_slug
         from job_posts jp
         join companies c on c.id = jp.company_id
         join users u on u.id = c.owner_user_id and u.deleted_at is null
         where jp.status = 'open'
         order by jp.created_at desc
         limit $1`,
        [jobsLimit],
      )
      jobs = fallbackJobRows.rows
    } catch {
      // ignore
    }
  }

  return { products, providers, services, jobs }
}

/**
 * Format search results for inclusion in the assistant prompt.
 * Covers produce (farmers), services (artisan_services + providers), and jobs (employers / job seekers).
 */
export function formatListingContext(products, providers, services = [], jobs = [], baseUrl = 'https://locallink.agency') {
  const lines = []

  if (products.length > 0) {
    lines.push('Current produce listings (suggest when the user wants to buy produce/food):')
    products.forEach((p) => {
      const price = p.price != null ? `GHS ${Number(p.price)}` : ''
      const unit = p.unit ? ` per ${p.unit}` : ''
      const farmer = p.farmer_name ? ` by ${p.farmer_name}` : ''
      lines.push(`- ${p.name}${farmer} — ${price}${unit}. Link: ${baseUrl}/marketplace/products/${p.id}`)
    })
    lines.push('')
  }

  if (services.length > 0) {
    lines.push('Current service offerings (suggest when the user wants cleaning, plumbing, catering, etc.; these are the actual service cards):')
    services.forEach((s) => {
      const price = s.price != null ? ` ${s.currency || 'GHS'} ${Number(s.price)}` : ''
      const by = s.artisan_name ? ` by ${s.artisan_name}` : ''
      lines.push(`- ${s.title}${by} — ${s.category ?? 'Service'}${price}. Profile: ${baseUrl}/u/${s.artisan_user_id}`)
    })
    lines.push('')
  }

  if (providers.length > 0) {
    lines.push('Current service providers / artisans (suggest when no specific service cards match, or as backup):')
    providers.forEach((p) => {
      const area = p.service_area ? ` (${p.service_area})` : ''
      lines.push(`- ${p.name} — ${p.verification_tier}${area}. Profile: ${baseUrl}/u/${p.user_id}`)
    })
    lines.push('')
  }

  if (jobs.length > 0) {
    lines.push('Current open job roles (suggest when the user is looking for work or to see who is hiring):')
    jobs.forEach((j) => {
      const pay = j.pay_min != null || j.pay_max != null
        ? ` ${j.currency || 'GHS'} ${j.pay_min ?? ''}-${j.pay_max ?? ''} ${j.pay_period || '/month'}`
        : ''
      const loc = j.location ? ` @ ${j.location}` : ''
      lines.push(`- ${j.title} at ${j.company_name}${loc}${pay}. Link: ${baseUrl}/jobs/${j.id}`)
    })
  }

  return lines.length ? lines.join('\n') : ''
}
