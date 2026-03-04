/**
 * OpenAI function-calling tool definitions for YAO assistant.
 * Each tool maps to a handler that executes DB queries or returns knowledge.
 */
import { pool } from '../db/pool.js'
import { ASSISTANT_KNOWLEDGE } from './assistantKnowledge.js'

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_services',
      description: 'Search for artisan services (cleaning, plumbing, catering, tiling, electrical, etc.) on the LocalLink platform. Call this when the user wants to hire someone or find a specific service.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Service type keywords, e.g. "cleaning", "plumber", "catering Accra"' },
          location: { type: 'string', description: 'Optional location filter, e.g. "Accra", "Kumasi"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search for produce and marketplace products (tomatoes, yams, plantain, etc.). Call this when the user wants to buy food, produce, or farm goods.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Product keywords, e.g. "tomatoes", "yam", "fresh vegetables"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_jobs',
      description: 'Search for open job postings on the platform. Call this when the user is looking for work, job openings, or wants to know who is hiring.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Job keywords, e.g. "carpenter", "driver", "Accra"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_providers',
      description: 'Search for artisan profiles by name, skill, or area. Call this when the user asks for a specific person or provider by name, or wants to browse providers.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Provider name, skill, or area, e.g. "Kofi", "plumber Tema"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_platform_info',
      description: 'Get information about how LocalLink works: escrow, verification, disputes, posting jobs, withdrawals, support, drivers, listing produce (farmers). Call for "how do I list produce?", "how does X work?", etc.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'The topic to get info about',
            enum: ['escrow', 'verification', 'disputes', 'posting_jobs', 'withdrawals', 'support', 'drivers', 'admin', 'listing_produce', 'general'],
          },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_orders',
      description: 'Get the current user\'s recent orders. Only works for authenticated users. Call when user asks about "my orders", "order status", or "what did I buy".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_jobs',
      description: 'Get the current user\'s recent jobs (posted or quoted on). Only works for authenticated users. Call when user asks about "my jobs", "my quotes", or "jobs I posted".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_wallet',
      description: 'Get the current user\'s wallet balance. Only works for authenticated users. Call when user asks about "my balance", "my wallet", or "how much money do I have".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_navigation',
      description: 'Generate a deep link/navigation suggestion for the user. Call this when you want to direct the user to a specific page on the platform.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Button label, e.g. "Post a job"' },
          url: { type: 'string', description: 'Relative URL path, e.g. "/buyer/jobs/new"' },
        },
        required: ['label', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'follow_user',
      description: 'Follow a provider/user on the platform. Call when the user says they want to follow someone. Requires authentication.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'The user ID to follow' },
          user_name: { type: 'string', description: 'The name of the user (for confirmation display)' },
        },
        required: ['user_id', 'user_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'prepare_job_post',
      description: 'Prepare a job posting for the user. Returns a pre-filled deep link. Call when the user describes a job they want to post (e.g. "I need a plumber in Accra, budget 500 cedis").',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Job title, e.g. "Plumbing repair"' },
          description: { type: 'string', description: 'Job description' },
          category: { type: 'string', description: 'Category, e.g. "plumbing", "cleaning", "catering"' },
          location: { type: 'string', description: 'Location, e.g. "Accra"' },
          budget: { type: 'number', description: 'Budget in GHS' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_follow_up_suggestions',
      description: 'Set 2-4 contextual follow-up questions the user might want to ask next. ALWAYS call this at the end of your response to provide relevant next steps based on what was just discussed.',
      parameters: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of 2-4 short follow-up questions. E.g. ["How much does it cost?", "Can I pay with mobile money?"]',
          },
        },
        required: ['suggestions'],
      },
    },
  },
]

function escapeLike(s) {
  return String(s).trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function extractWords(q) {
  const stop = new Set([
    'i', 'me', 'my', 'am', 'is', 'are', 'need', 'want', 'looking', 'for', 'some',
    'the', 'a', 'an', 'to', 'get', 'buy', 'find', 'hire', 'available', 'please',
    'in', 'at', 'near', 'around', 'what', 'have', 'you', 'can', 'show', 'there',
    'someone', 'who', 'does', 'that', 'options', 'any', 'do',
  ])
  return String(q).toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length >= 2 && !stop.has(w))
}

const STEM_MAP = new Map([
  ['cleaner', 'cleaning'], ['cleaners', 'cleaning'], ['clean', 'cleaning'],
  ['plumber', 'plumbing'], ['plumbers', 'plumbing'],
  ['electrician', 'electrical'], ['electricians', 'electrical'],
  ['plasterer', 'plastering'], ['plasterers', 'plastering'],
  ['caterer', 'catering'], ['caterers', 'catering'],
  ['tiler', 'tiling'], ['tilers', 'tiling'],
])

function stemWords(words) {
  return words.map((w) => STEM_MAP.get(w) ?? w)
}

async function handleSearchServices({ query, location }) {
  const words = stemWords(extractWords(query || ''))
  if (!words.length) return { services: [], message: 'No search terms provided' }

  const tsQuery = words.map((w) => w + ':*').join(' | ')
  const params = [tsQuery]
  let where = '(s.search_vector @@ to_tsquery(\'english\', $1))'
  if (location) {
    params.push(`%${escapeLike(location)}%`)
    where += ` and a.service_area ilike $${params.length}`
  }
  params.push(8)

  try {
    const { rows } = await pool.query(
      `select s.id, s.artisan_user_id, s.title, s.description, s.price, s.currency,
              s.duration_minutes, s.category, s.image_url,
              u.name as artisan_name, a.service_area,
              coalesce(v.level, 'unverified') as verification_tier,
              ts_rank(s.search_vector, to_tsquery('english', $1)) as rank
       from artisan_services s
       join users u on u.id = s.artisan_user_id and u.deleted_at is null
         and (u.suspended_until is null or u.suspended_until <= now())
       left join artisans a on a.user_id = u.id
       left join verification_levels v on v.user_id = u.id
       where ${where}
       order by rank desc, s.sort_order asc
       limit $${params.length}`,
      params,
    )
    if (rows.length) return { services: rows }
  } catch { /* FTS column may not exist yet — fall through to ILIKE */ }

  const pattern = '\\m(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\M'
  const fbParams = [pattern]
  let fbWhere = '(s.title ~* $1 or s.category ~* $1 or coalesce(s.description, \'\') ~* $1)'
  if (location) {
    fbParams.push(`%${escapeLike(location)}%`)
    fbWhere += ` and a.service_area ilike $${fbParams.length}`
  }
  fbParams.push(8)

  try {
    const { rows } = await pool.query(
      `select s.id, s.artisan_user_id, s.title, s.description, s.price, s.currency,
              s.duration_minutes, s.category, s.image_url,
              u.name as artisan_name, a.service_area,
              coalesce(v.level, 'unverified') as verification_tier
       from artisan_services s
       join users u on u.id = s.artisan_user_id and u.deleted_at is null
         and (u.suspended_until is null or u.suspended_until <= now())
       left join artisans a on a.user_id = u.id
       left join verification_levels v on v.user_id = u.id
       where ${fbWhere}
       order by s.sort_order asc, s.created_at desc
       limit $${fbParams.length}`,
      fbParams,
    )
    return { services: rows }
  } catch {
    return { services: [], error: 'Search failed' }
  }
}

async function handleSearchProducts({ query }) {
  const words = extractWords(query || '')
  if (!words.length) return { products: [], message: 'No search terms provided' }

  const tsQuery = words.map((w) => w + ':*').join(' | ')

  try {
    const { rows } = await pool.query(
      `select p.id, p.name, p.category, p.quantity, p.unit, p.price, p.image_url,
              f.farm_location, u.id as farmer_user_id, u.name as farmer_name,
              ts_rank(p.search_vector, to_tsquery('english', $1)) as rank
       from products p
       left join farmers f on f.id = p.farmer_id
       left join users u on u.id = f.user_id and u.deleted_at is null
       where p.status = 'available' and (p.quantity is null or p.quantity > 0)
         and p.search_vector @@ to_tsquery('english', $1)
       order by rank desc
       limit $2`,
      [tsQuery, 8],
    )
    if (rows.length) return { products: rows }
  } catch { /* FTS may not exist — fall through */ }

  const patterns = words.map((w) => `%${escapeLike(w)}%`)
  const conds = patterns.map((_, i) => `(p.name ilike $${i + 1} or p.category ilike $${i + 1})`)
  const params = [...patterns, 8]

  try {
    const { rows } = await pool.query(
      `select p.id, p.name, p.category, p.quantity, p.unit, p.price, p.image_url,
              f.farm_location, u.id as farmer_user_id, u.name as farmer_name
       from products p
       left join farmers f on f.id = p.farmer_id
       left join users u on u.id = f.user_id and u.deleted_at is null
       where p.status = 'available' and (p.quantity is null or p.quantity > 0)
         and (${conds.join(' or ')})
       order by p.created_at desc
       limit $${params.length}`,
      params,
    )
    return { products: rows }
  } catch {
    return { products: [], error: 'Search failed' }
  }
}

async function handleSearchJobs({ query }) {
  const words = extractWords(query || '')

  if (words.length) {
    const tsQuery = words.map((w) => w + ':*').join(' | ')
    try {
      const { rows } = await pool.query(
        `select jp.id, jp.title, jp.location, jp.employment_type, jp.work_mode,
                jp.pay_min, jp.pay_max, jp.currency, jp.pay_period, jp.image_url,
                c.name as company_name, c.slug as company_slug,
                ts_rank(jp.search_vector, to_tsquery('english', $1)) as rank
         from job_posts jp
         join companies c on c.id = jp.company_id
         join users u on u.id = c.owner_user_id and u.deleted_at is null
         where jp.status = 'open' and jp.search_vector @@ to_tsquery('english', $1)
         order by rank desc
         limit $2`,
        [tsQuery, 6],
      )
      if (rows.length) return { jobs: rows }
    } catch { /* FTS may not exist — fall through */ }
  }

  const params = words.length ? words.map((w) => `%${escapeLike(w)}%`) : []
  let where = 'jp.status = \'open\''
  if (params.length) {
    const conds = params.map((_, i) =>
      `(jp.title ilike $${i + 1} or jp.description ilike $${i + 1} or jp.location ilike $${i + 1} or c.name ilike $${i + 1})`,
    )
    where += ` and (${conds.join(' or ')})`
  }
  params.push(6)

  try {
    const { rows } = await pool.query(
      `select jp.id, jp.title, jp.location, jp.employment_type, jp.work_mode,
              jp.pay_min, jp.pay_max, jp.currency, jp.pay_period, jp.image_url,
              c.name as company_name, c.slug as company_slug
       from job_posts jp
       join companies c on c.id = jp.company_id
       join users u on u.id = c.owner_user_id and u.deleted_at is null
       where ${where}
       order by jp.created_at desc
       limit $${params.length}`,
      params,
    )
    return { jobs: rows }
  } catch {
    return { jobs: [], error: 'Search failed' }
  }
}

async function handleSearchProviders({ query }) {
  const words = extractWords(query || '')
  if (!words.length) return { providers: [], message: 'No search terms provided' }

  const patterns = words.map((w) => `%${escapeLike(w)}%`)
  const conds = patterns.map((_, i) => `(u.name ilike $${i + 1} or a.service_area ilike $${i + 1} or a.primary_skill ilike $${i + 1})`)
  const params = [...patterns, 5]

  try {
    const { rows } = await pool.query(
      `select distinct on (u.id) u.id as user_id, u.name,
              coalesce(v.level, 'unverified') as verification_tier,
              a.service_area
       from users u
       join artisans a on a.user_id = u.id
       left join verification_levels v on v.user_id = u.id
       where u.deleted_at is null
         and (u.suspended_until is null or u.suspended_until <= now())
         and (${conds.join(' or ')})
       order by u.id, a.premium desc nulls last
       limit $${params.length}`,
      params,
    )
    return { providers: rows }
  } catch {
    return { providers: [], error: 'Search failed' }
  }
}

const KNOWLEDGE_SECTIONS = {
  escrow: '### Escrow (Trust Wallet)\n- Escrow holds money safely until the job is done or delivery is confirmed.\n- For jobs: Buyer posts job → accepts quote → funds escrow → provider completes → buyer confirms → funds released (minus platform fee).\n- For orders: Buyer places order → escrow holds → delivery confirmed → funds release to farmer and driver.\n- Currency: GHS (Ghana Cedis). Payouts processed within 5 business days.',
  verification: '### Verification Tiers\n- Unverified: Basic account, cannot accept paid work.\n- Bronze: ID verified (Ghana Card) + early history. Required for paid work and listing produce.\n- Silver: Stronger verification + proven outcomes.\n- Gold: Highest trust tier.\n- To upgrade: Submit Ghana Card via profile (Unverified→Bronze), then complete jobs and earn reviews (Bronze→Silver→Gold).',
  disputes: '### Disputes\n- If something goes wrong, open a dispute with evidence. Escrow is frozen until an admin resolves it.\n- Resolution is done by admins only; the assistant cannot approve or release escrow.',
  posting_jobs: '### Posting a Job\n- Buyers: Post a job (title, description, location, budget) → providers send quotes → accept a quote → fund escrow → work done → confirm → funds release.\n- Companies: Post roles via Jobs section and manage applicants.',
  withdrawals: '### Withdrawals\n- After escrow release, withdraw to Mobile Money or bank from your wallet.\n- Payouts processed within 5 business days.',
  support: '### Support\n- For issues the assistant cannot resolve, open a support ticket from the Support page.\n- Keep payments on the platform for escrow protection.',
  drivers: '### Drivers\n- Claim available deliveries from driver dashboard. Completed deliveries release escrow.\n- Bronze or higher required for paid deliveries.\n- Withdraw to Mobile Money or bank after release.',
  admin: '### Admin Operations\n- Admins resolve disputes: review evidence, release to buyer or provider, or refund.\n- View metrics, support tickets, and platform health from the Admin dashboard.',
  general: ASSISTANT_KNOWLEDGE,
}

function handleGetPlatformInfo({ topic }) {
  return { info: KNOWLEDGE_SECTIONS[topic] || KNOWLEDGE_SECTIONS.general }
}

async function handleGetUserOrders(userId) {
  if (!userId) return { error: 'You need to be logged in to see your orders.' }
  try {
    const { rows } = await pool.query(
      `select o.id, o.status, o.total_amount, o.currency, o.created_at,
              p.name as product_name
       from orders o
       left join products p on p.id = o.product_id
       where o.buyer_id = $1
       order by o.created_at desc
       limit 5`,
      [userId],
    )
    if (!rows.length) return { orders: [], message: 'You have no recent orders.' }
    return { orders: rows }
  } catch {
    return { orders: [], error: 'Could not fetch orders' }
  }
}

async function handleGetUserJobs(userId, userRole) {
  if (!userId) return { error: 'You need to be logged in to see your jobs.' }
  try {
    if (userRole === 'buyer' || userRole === 'company') {
      const { rows } = await pool.query(
        `select j.id, j.title, j.status, j.budget, j.currency, j.created_at,
                (select count(*) from quotes q where q.job_id = j.id) as quote_count
         from jobs j
         where j.buyer_id = $1
         order by j.created_at desc
         limit 5`,
        [userId],
      )
      if (!rows.length) return { jobs: [], message: 'You have no recent jobs.' }
      return { jobs: rows }
    }
    const { rows } = await pool.query(
      `select j.id, j.title, j.status, j.budget, j.currency, j.created_at,
              q.amount as my_quote_amount, q.status as my_quote_status
       from quotes q
       join jobs j on j.id = q.job_id
       where q.provider_id = $1
       order by q.created_at desc
       limit 5`,
      [userId],
    )
    if (!rows.length) return { jobs: [], message: 'You have no recent quotes.' }
    return { jobs: rows }
  } catch {
    return { jobs: [], error: 'Could not fetch jobs' }
  }
}

async function handleGetUserWallet(userId) {
  if (!userId) return { error: 'You need to be logged in to see your wallet.' }
  try {
    const { rows } = await pool.query(
      'select balance, currency from wallets where user_id = $1',
      [userId],
    )
    if (!rows.length) return { balance: 0, currency: 'GHS' }
    return { balance: Number(rows[0].balance), currency: rows[0].currency || 'GHS' }
  } catch {
    return { error: 'Could not fetch wallet' }
  }
}

async function handleFollowUser({ user_id, user_name }, viewerId) {
  if (!viewerId) return { error: 'You need to be logged in to follow someone.' }
  if (!user_id) return { error: 'Missing user ID.' }
  try {
    await pool.query(
      `insert into user_follows (follower_id, followed_id) values ($1, $2) on conflict do nothing`,
      [viewerId, user_id],
    )
    return { success: true, message: `You are now following ${user_name || 'this user'}.` }
  } catch {
    return { error: 'Could not follow user. Please try from their profile page.' }
  }
}

function handlePrepareJobPost({ title, description, category, location, budget }) {
  const params = new URLSearchParams()
  if (title) params.set('title', title)
  if (description) params.set('description', description)
  if (category) params.set('category', category)
  if (location) params.set('location', location)
  if (budget) params.set('budget', String(budget))
  const url = `/buyer/jobs/new?${params.toString()}`
  return {
    action: { label: `Post job: ${title}`, url },
    message: `I've prepared a job posting for "${title}". Tap the button to review and submit it.`,
  }
}

/**
 * Execute a tool call and return the result as a string for the model.
 */
export async function executeTool(toolName, args, { userId, userRole } = {}) {
  switch (toolName) {
    case 'search_services':
      return handleSearchServices(args)
    case 'search_products':
      return handleSearchProducts(args)
    case 'search_jobs':
      return handleSearchJobs(args)
    case 'search_providers':
      return handleSearchProviders(args)
    case 'get_platform_info':
      return handleGetPlatformInfo(args)
    case 'get_user_orders':
      return handleGetUserOrders(userId)
    case 'get_user_jobs':
      return handleGetUserJobs(userId, userRole)
    case 'get_user_wallet':
      return handleGetUserWallet(userId)
    case 'suggest_navigation':
      return { action: { label: args.label, url: args.url } }
    case 'follow_user':
      return handleFollowUser(args, userId)
    case 'prepare_job_post':
      return handlePrepareJobPost(args)
    case 'set_follow_up_suggestions':
      return { follow_ups: Array.isArray(args.suggestions) ? args.suggestions.slice(0, 4) : [] }
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
