import { Router } from 'express'
import OpenAI, { toFile } from 'openai'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { optionalAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { ASSISTANT_KNOWLEDGE } from '../lib/assistantKnowledge.js'
import { searchForAssistant, formatListingContext } from '../lib/assistantSearch.js'
import { detectIntent, getIntentGuidance, getIntentActions } from '../lib/assistantIntent.js'

export const assistantRouter = Router()

const voiceRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many voice requests. Please wait a moment.' },
})

const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(audio|video)\/(webm|mp4|mpeg|mp3|m4a|wav|ogg|x-m4a)$/.test(file.mimetype || '')
    cb(null, !!ok)
  },
})

const SYSTEM_PROMPT_BASE = `You are YAO, the LocalLink Platform Guide. You are friendly, professional, local, and helpful. Your role is to help users get things done on LocalLink.

Voice: Always reply in first person as YAO (e.g. "I can help you with that", "Here are some options I found"). Keep a warm, professional tone. When it fits, you may use local flavour (e.g. "you're welcome", "no wahala") but stay clear and helpful.
Example tone: "Hi, I'm YAO. I can help you find workers, post jobs, track orders, or answer questions about escrow and payments. What do you need today?"

You help users in Ghana with:
- How escrow and payments work
- Verification tiers (Bronze, Silver, Gold)
- How to post jobs and hire workers
- Disputes and withdrawals
- General platform questions
- Suggesting real products (produce), services (artisans), and job roles (employers) so all user types get relevant results: buyers (produce + services), job seekers (open jobs), farmers/artisans (visibility), companies (their roles surface when users search).

You support a continuous conversation: the user can go back and forth from initial idea (e.g. "I need a plasterer") through every step—finding providers, posting a job, getting quotes, accepting a quote, funding escrow, work done, releasing payment. Use the conversation history to remember what they said and guide them to the next step. If they asked for plasterers earlier and now ask "how do I hire one?", explain posting a job or contacting from the cards. If they say they accepted a quote, explain funding escrow and what happens when work is done.

Rules:
1. Use ONLY the platform knowledge and any listing data provided below. Do not invent listings or features.
2. When LIVE LISTINGS are provided below (produce, service offerings, providers, or jobs): your reply must be plain text only, 1–2 short sentences. Example: "Here are some cleaning services on the platform. Tap a card to view details and book." Do NOT list any individual items (no service names, prices, or provider names in your message). Do NOT use markdown links (no [View Profile](url) or [text](url)). Do NOT use bullet points or asterisks for the listings—the frontend already shows the real cards with links under your message. Only when NO listings are provided should you suggest browsing Marketplace, posting a job, or the Jobs board.
3. Keep answers short. When cards will appear, 1–2 sentences only. Use bullet points only for step-by-step instructions (e.g. how to post a job), never for listings.
4. If the user asks something outside platform support (e.g. weather, other sites), politely say you only help with LocalLink.
5. Never suggest paying or sharing contact details outside the platform before work is done and escrow is released.
6. For account-specific or sensitive issues, suggest opening a support ticket.

Platform knowledge:
${ASSISTANT_KNOWLEDGE}`

assistantRouter.post(
  '/chat',
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  optionalAuth,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {}
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return res.status(400).json({ message: 'message is required' })
    if (message.length > 2000) return res.status(400).json({ message: 'message too long' })

    // Optional conversation history for multi-turn (from conception through process)
    const rawHistory = Array.isArray(body.history) ? body.history : []
    const MAX_HISTORY = 20
    const MAX_CONTENT_LEN = 800
    const history = rawHistory
      .slice(-MAX_HISTORY)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, MAX_CONTENT_LEN) }))

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      return res.json({
        reply: "The assistant isn't configured right now. Please use the Support page to open a ticket, or email/contact LocalLink directly.",
        conversation_id: body.conversation_id ?? null,
      })
    }

    const openai = new OpenAI({ apiKey })
    const userRole = req.user?.role ?? 'guest'

    // Merge with last user message from history so follow-ups like "how do I hire one?" keep showing relevant cards (e.g. plasterer)
    const lastUserFromHistory = history.filter((m) => m.role === 'user').pop()?.content ?? ''
    const searchQuery = [lastUserFromHistory, message].filter(Boolean).join(' ').trim() || message

    // Intent detection: route to the right knowledge and actions (PAYMENT, DISPUTE, HIRING, etc.)
    const { intent } = detectIntent(message, lastUserFromHistory)

    // Fetch live products, providers, services (artisan_services), and jobs so the assistant can suggest for all user types
    const { products, providers, services, jobs } = await searchForAssistant(searchQuery, {
      productsLimit: 8,
      providersLimit: 5,
      servicesLimit: 8,
      jobsLimit: 6,
    })
    const listingBlob = formatListingContext(products, providers, services ?? [], jobs ?? [])
    const hasNoListings = !listingBlob || listingBlob.trim() === ''
    const roleGuidance =
      userRole === 'buyer'
        ? 'User is a buyer: prefer suggesting services and produce (marketplace); mention Jobs board only if they ask about hiring or posting work.'
        : userRole === 'artisan' || userRole === 'farmer'
          ? 'User is a provider (artisan/farmer): they may want to find work (jobs) or see their own services; suggest Marketplace services and Jobs board when relevant.'
          : userRole === 'driver'
            ? 'User is a driver: they care about claiming deliveries, getting paid for delivery, and delivery flows; suggest delivery-related help and Jobs board for transport roles when relevant.'
          : userRole === 'admin'
            ? 'User is an admin: they may need to resolve disputes, view metrics, or handle support. Suggest opening the Admin dashboard for disputes and metrics; explain that only admins can release escrow in disputes.'
          : userRole === 'employer' || userRole === 'company'
            ? 'User is employer/company: prefer job listings, posting jobs, and hiring flows when relevant; mention how to manage applicants and escrow for employers.'
            : 'User is a guest: suggest services, produce, and jobs as relevant.'
    const intentGuidance = getIntentGuidance(intent)
    const systemContent =
      SYSTEM_PROMPT_BASE +
      `\n\n[${roleGuidance} Answer in a helpful, neutral tone.]` +
      (intentGuidance ? `\n\n[Intent: ${intent}. ${intentGuidance}]` : '') +
      (listingBlob
        ? `\n\n--- LIVE LISTINGS (use these to suggest when the user wants to buy or hire) ---\n${listingBlob}\n---`
        : '') +
      (hasNoListings
        ? '\n\n[No live listings matched this query. Tell the user you don\'t have any matching results right now. Suggest they try the Marketplace or Jobs board, or try different keywords.]'
        : '')

    const apiMessages = [
      { role: 'system', content: systemContent },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: apiMessages,
      max_tokens: 600,
      temperature: 0.3,
    })

    let reply = completion.choices?.[0]?.message?.content?.trim() ?? "I couldn't generate a reply. Please try rephrasing or use Support."
    // Strip markdown links so the message is plain text (cards are shown below)
    reply = reply.replace(/\s*\[[^\]]*\]\([^)]*\)/g, '').replace(/\n{3,}/g, '\n\n').trim()

    // Return structured suggestions so the frontend can render product/provider cards
    const suggested_products = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      unit: p.unit,
      quantity: p.quantity,
      image_url: p.image_url ?? null,
      farm_location: p.farm_location ?? null,
      farmer_user_id: p.farmer_user_id ?? null,
      farmer_name: p.farmer_name ?? null,
    }))
    // When we have service cards or job cards, show only those (no provider name cards)
    const suggested_providers =
      (services ?? []).length > 0 || (jobs ?? []).length > 0
        ? []
        : providers.map((p) => ({
            user_id: p.user_id,
            name: p.name,
            verification_tier: p.verification_tier ?? 'unverified',
            service_area: p.service_area ?? null,
          }))
    const suggested_services = (services ?? []).map((s) => ({
      id: s.id,
      artisan_user_id: s.artisan_user_id,
      title: s.title,
      description: s.description ?? null,
      price: s.price ?? null,
      currency: s.currency ?? 'GHS',
      duration_minutes: s.duration_minutes ?? null,
      category: s.category ?? null,
      image_url: s.image_url ?? null,
      artisan_name: s.artisan_name ?? null,
      service_area: s.service_area ?? null,
      verification_tier: s.verification_tier ?? 'unverified',
    }))
    // When we have matching service cards, show only those (no job cards) so "I need a caterer" shows catering services not job listings
    const suggested_jobs = (services ?? []).length > 0 ? [] : (jobs ?? []).map((j) => ({
      id: j.id,
      title: j.title,
      company_name: j.company_name,
      company_slug: j.company_slug ?? null,
      location: j.location ?? null,
      employment_type: j.employment_type ?? null,
      work_mode: j.work_mode ?? null,
      pay_min: j.pay_min ?? null,
      pay_max: j.pay_max ?? null,
      currency: j.currency ?? 'GHS',
      pay_period: j.pay_period ?? null,
      image_url: j.image_url ?? null,
    }))

    // P2: Deep links and next-step chips when we showed cards (or when no results, so user can try Marketplace/Jobs)
    const hasProvidersOrProducts = providers.length > 0 || products.length > 0 || (services ?? []).length > 0
    const hasJobs = suggested_jobs.length > 0
    const suggested_actions = []
    if (hasProvidersOrProducts) {
      suggested_actions.push({ label: 'Post a job', url: '/buyer/jobs/new' }, { label: 'Marketplace', url: '/marketplace' })
    }
    if (hasJobs && !suggested_actions.some((a) => a.url === '/jobs')) {
      suggested_actions.push({ label: 'Jobs board', url: '/jobs' })
    }
    if (hasNoListings && suggested_actions.length === 0) {
      suggested_actions.push({ label: 'Marketplace', url: '/marketplace' }, { label: 'Jobs board', url: '/jobs' })
    }
    // Role-based deep links so users can jump to the right place
    const roleLinks = {
      buyer: [{ label: 'Find providers', url: '/buyer/providers' }, { label: 'My orders', url: '/buyer/orders' }],
      artisan: [{ label: 'My services', url: '/artisan/services' }, { label: 'Jobs I can quote', url: '/artisan' }],
      farmer: [{ label: 'My produce', url: '/farmer' }, { label: 'Orders', url: '/farmer/orders' }],
      driver: [{ label: 'Open deliveries', url: '/driver' }],
      company: [{ label: 'Company dashboard', url: '/company' }, { label: 'Post a job', url: '/jobs' }],
      admin: [{ label: 'Admin dashboard', url: '/admin' }],
    }
    const addRoleLinks = roleLinks[userRole]
    if (addRoleLinks) {
      for (const a of addRoleLinks) {
        if (!suggested_actions.some((x) => x.url === a.url)) suggested_actions.push(a)
      }
    }
    const intentActions = getIntentActions(intent, userRole)
    for (const a of intentActions) {
      if (!suggested_actions.some((x) => x.url === a.url)) suggested_actions.push(a)
    }
    const suggested_replies = []
    if (hasProvidersOrProducts) suggested_replies.push('How do I post a job?', 'How does escrow work?')
    if (hasJobs) {
      suggested_replies.push('How does escrow work?', 'How do I apply for a job?')
    }
    const uniqueReplies = [...new Set(suggested_replies)]

    // Role-based card order: show most relevant section first for this user type
    const cardOrder =
      userRole === 'buyer'
        ? ['services', 'products', 'jobs', 'providers']
        : userRole === 'artisan' || userRole === 'farmer'
          ? ['services', 'jobs', 'products', 'providers']
          : userRole === 'driver'
            ? ['jobs', 'services', 'products', 'providers']
            : userRole === 'employer' || userRole === 'company'
              ? ['jobs', 'services', 'products', 'providers']
              : ['services', 'products', 'jobs', 'providers']

    return res.json({
      reply,
      conversation_id: body.conversation_id ?? null,
      suggested_products,
      suggested_providers,
      suggested_services,
      suggested_jobs,
      card_order: cardOrder,
      suggested_actions: suggested_actions.length ? suggested_actions : undefined,
      suggested_replies: uniqueReplies.length ? uniqueReplies : undefined,
    })
  }),
)

// Voice: speech-to-text (Whisper) — multipart form with "audio" file
assistantRouter.post(
  '/transcribe',
  voiceRateLimit,
  optionalAuth,
  (req, res, next) => {
    multerMemory.single('audio')(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Audio file too large (max 25MB)' : 'Invalid audio upload' })
      next()
    })
  },
  asyncHandler(async (req, res) => {
    if (!req.file?.buffer) return res.status(400).json({ message: 'No audio file (use form field "audio")' })
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) return res.status(503).json({ message: 'Voice is not configured' })
    const openai = new OpenAI({ apiKey })
    const ext = (req.file.originalname?.match(/\.\w+$/) || [''])[0] || '.webm'
    const file = await toFile(req.file.buffer, `audio${ext}`)
    const transcription = await openai.audio.transcriptions.create({ file, model: 'whisper-1' })
    const text = (transcription?.text || '').trim()
    return res.json({ text: text || '' })
  }),
)

// Voice: text-to-speech (TTS) — JSON body { text }, returns audio/mpeg
const TTS_MAX_LEN = 4096
assistantRouter.post(
  '/speak',
  voiceRateLimit,
  optionalAuth,
  asyncHandler(async (req, res) => {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, TTS_MAX_LEN) : ''
    if (!text) return res.status(400).json({ message: 'text is required' })
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) return res.status(503).json({ message: 'Voice is not configured' })
    const openai = new OpenAI({ apiKey })
    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: text,
    })
    const buffer = Buffer.from(await speech.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(buffer)
  }),
)
