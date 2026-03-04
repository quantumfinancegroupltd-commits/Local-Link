import { Router } from 'express'
import OpenAI, { toFile } from 'openai'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { optionalAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { TOOL_DEFINITIONS, executeTool } from '../lib/assistantTools.js'
import { pool } from '../db/pool.js'

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

/** Collapse repeated phrases (e.g. "To list yourTo list your...") to avoid model repetition bugs. */
function collapseRepeatedPhrase(text, minLen = 10) {
  if (!text || typeof text !== 'string') return text
  const t = text.trim()
  if (t.length < minLen * 2) return t
  for (let len = minLen; len <= Math.min(50, t.length / 2); len++) {
    const candidate = t.slice(0, len)
    let pos = len
    while (pos + len <= t.length && t.slice(pos, pos + len) === candidate) pos += len
    if (pos > len) return (candidate + t.slice(pos)).trim()
  }
  return t
}

const DEFAULT_REPLY = "I'm YAO, your LocalLink guide. You can ask me how to list produce, find services or jobs, how payments and escrow work, or anything about the platform. What would you like to know?"

/** If reply is truncated or placeholder, append or replace with a sensible fallback. */
function ensureCompleteReply(reply, userMessage, collectedResults) {
  if (reply === undefined || reply === null) return DEFAULT_REPLY
  if (typeof reply !== 'string') return DEFAULT_REPLY
  const r = reply.trim()
  if (!r) return DEFAULT_REPLY
  const q = (userMessage || '').toLowerCase()
  const hasServices = collectedResults?.services?.length > 0
  const hasProducts = collectedResults?.products?.length > 0
  const hasJobs = collectedResults?.jobs?.length > 0
  const hasProviders = collectedResults?.providers?.length > 0

  if (/^\?\?|^\.\.\.$|^\.\.\.\s*$/.test(r)) {
    if (hasServices) return 'Here are some services that match. Tap a card to view details and book.'
    if (hasProducts) return 'Here are some products I found. Tap a card to view and order.'
    if (hasJobs) return 'Here are some open jobs. Tap a card to view details and apply.'
    if (hasProviders) return 'Here are some providers. Tap a card to view their profile.'
    return "Here's what I found. Tap any card below for more details, or ask me something else."
  }

  if (r.length < 60 && /list\s*produce|listing\s*produce|how\s*do\s*i\s*list/.test(q)) {
    return 'Go to **My Produce** from the main menu (Farmer dashboard) to add your products. You need at least Bronze verification (Ghana Card) to list produce.'
  }
  if (r.length < 40 && /service|services\s*available/.test(q) && hasServices) {
    return (r || 'Here are some services.') + ' Tap a card below to view details and book.'
  }
  if (r.length < 40 && /job|jobs|open\s*position/.test(q) && hasJobs) {
    return (r || 'Here are some open jobs.') + ' Tap a card below to view and apply.'
  }
  if (r.length < 60 && hasProducts && /grocer|produce|food|buy|vegetable|fruit|market/.test(q)) {
    return 'Here are some produce and groceries from the marketplace. Tap a card to view details and order.'
  }

  // Catch-all: reply looks truncated (short and doesn't end a sentence)
  const looksComplete = /[.!?]\s*$|\n\s*$/.test(r) || r.length >= 80
  if (r.length < 25 && !looksComplete) {
    return DEFAULT_REPLY
  }
  if (r.length >= 25 && r.length < 50 && !looksComplete) {
    return r + ' I\'m YAO, your LocalLink guide — ask me about listing produce, services, jobs, or payments.'
  }

  return r
}

const SYSTEM_PROMPT = `You are YAO, the LocalLink Platform Guide. You are friendly, professional, local, and helpful.

Voice: Always reply in first person as YAO. Keep a warm, professional tone. When it fits, use local flavour ("no wahala", "you're welcome") but stay clear and helpful.

You help users in Ghana with:
- Finding services, products, providers, and jobs on the platform
- Explaining how escrow, payments, verification, and disputes work
- Guiding them through hiring, posting jobs, placing orders
- Checking their orders, jobs, quotes, and wallet balance

You have tools available. USE THEM:
- When a user wants to find/hire someone → call search_services
- When a user wants to buy produce/food → call search_products
- When a user asks about jobs/hiring/work → call search_jobs
- When they ask "how does X work?" or "how do I list produce?" → call get_platform_info (use topic listing_produce for listing produce)
- When they ask about "my orders/jobs/wallet" → call the appropriate user data tool
- You can call MULTIPLE tools in one turn if needed

CRITICAL RULES:
1. When tools return listings (services, products, jobs, providers): your text reply must be 1-2 SHORT sentences only. Do NOT list individual items in your text — the frontend renders cards automatically from the tool results. Example: "Here are some cleaning services I found. Tap a card to view details and book."
2. When tools return user data (orders, jobs, wallet): summarize the data conversationally. Example: "You have 3 recent orders. Your latest is for tomatoes, currently being delivered."
3. Never invent listings or features not returned by tools.
4. For issues you can't resolve, suggest opening a support ticket.
5. Never suggest paying or sharing contact details outside the platform.
6. If asked something outside LocalLink support, politely say you only help with LocalLink.
7. Support multi-turn: remember what was discussed and guide to next steps.
8. Never repeat the same phrase or sentence multiple times in a row. Give one clear, concise answer.`

const MAX_TOOL_ROUNDS = 3

assistantRouter.post(
  '/chat',
  rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }),
  optionalAuth,
  asyncHandler(async (req, res) => {
    const wantsStream = String(req.headers.accept || '').includes('text/event-stream')
    const body = req.body ?? {}
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return res.status(400).json({ message: 'message is required' })
    if (message.length > 2000) return res.status(400).json({ message: 'message too long' })

    const rawHistory = Array.isArray(body.history) ? body.history : []
    const history = rawHistory
      .slice(-20)
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 800) }))

    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
      return res.json({
        reply: "The assistant isn't configured right now. Please use the Support page to open a ticket.",
        conversation_id: body.conversation_id ?? null,
      })
    }

    const openai = new OpenAI({ apiKey })
    const userId = req.user?.sub ?? null
    const userRole = req.user?.role ?? 'guest'
    const toolContext = { userId, userRole }

    const roleNote = {
      buyer: 'User is a buyer. They hire services and buy produce.',
      artisan: 'User is an artisan/provider. They offer services and quote on jobs.',
      farmer: 'User is a farmer. They sell produce and manage orders.',
      driver: 'User is a driver. They claim and complete deliveries.',
      company: 'User is a company. They post job roles and manage staff.',
      admin: 'User is an admin. They manage disputes, users, and platform health.',
    }[userRole] || 'User is a guest (not logged in).'

    const systemContent = SYSTEM_PROMPT + `\n\n[${roleNote}]`

    const messages = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: message },
    ]

    const collectedResults = {
      services: [],
      products: [],
      jobs: [],
      providers: [],
      actions: [],
      followUps: [],
    }

    async function runToolLoop() {
      let completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        max_tokens: 800,
        temperature: 0.3,
      })

      let choice = completion.choices?.[0]
      let rounds = 0

      while (choice?.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length && rounds < MAX_TOOL_ROUNDS) {
        rounds++
        const assistantMsg = choice.message
        messages.push(assistantMsg)

        const toolResults = await Promise.all(
          assistantMsg.tool_calls.map(async (tc) => {
            const args = (() => {
              try { return JSON.parse(tc.function.arguments) } catch { return {} }
            })()
            const result = await executeTool(tc.function.name, args, toolContext)

          if (result.services?.length) collectedResults.services.push(...result.services)
          if (result.products?.length) collectedResults.products.push(...result.products)
          if (result.jobs?.length) collectedResults.jobs.push(...result.jobs)
          if (result.providers?.length) collectedResults.providers.push(...result.providers)
          if (result.action) collectedResults.actions.push(result.action)
          if (result.follow_ups?.length) collectedResults.followUps.push(...result.follow_ups)

            return { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) }
          }),
        )
        messages.push(...toolResults)

        completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          tools: TOOL_DEFINITIONS,
          tool_choice: 'auto',
          max_tokens: 800,
          temperature: 0.3,
        })
        choice = completion.choices?.[0]
      }

      return choice
    }

    // --- Streaming path ---
    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()

      const sendSSE = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        if (typeof res.flush === 'function') res.flush()
      }

      sendSSE('status', { status: 'thinking' })

      // Run tool loop (non-streamed — tools are fast)
      const lastChoice = await runToolLoop()
      let streamedPathFullReply = ''

      // Now stream the final text reply
      const finalMessages = [...messages]
      if (lastChoice?.message?.content) {
        // Non-streaming already got the reply via tool loop
        let reply = lastChoice.message.content.trim()
        reply = reply.replace(/\s*\[[^\]]*\]\([^)]*\)/g, '').replace(/\n{3,}/g, '\n\n').trim()
        reply = collapseRepeatedPhrase(reply)
        reply = ensureCompleteReply(reply, message, collectedResults)

        for (let i = 0; i < reply.length; i += 12) {
          sendSSE('token', { text: reply.slice(i, i + 12) })
        }
      } else {
        // Stream the final completion; buffer so we can fix truncated/placeholder replies
        const stream = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: finalMessages,
          max_tokens: 800,
          temperature: 0.3,
          stream: true,
        })
        let streamedBuffer = ''
        for await (const chunk of stream) {
          const text = chunk.choices?.[0]?.delta?.content
          if (text) {
            streamedBuffer += text
            sendSSE('token', { text })
          }
        }
        // If streamed reply is truncated or placeholder, send fallback as extra tokens
        const fixed = ensureCompleteReply(collapseRepeatedPhrase(streamedBuffer.trim()), message, collectedResults)
        streamedPathFullReply = fixed || streamedBuffer.trim()
        if (fixed && fixed.length > streamedBuffer.trim().length) {
          const suffix = fixed.slice(streamedBuffer.trim().length)
          for (let i = 0; i < suffix.length; i += 12) {
            sendSSE('token', { text: suffix.slice(i, i + 12) })
          }
        }
      }

      // Send cards and metadata
      const metadata = buildResponseMetadata(collectedResults)

      // Collect full streamed reply for persistence
      let fullReply = ''
      if (lastChoice?.message?.content) {
        fullReply = lastChoice.message.content.trim().replace(/\s*\[[^\]]*\]\([^)]*\)/g, '').replace(/\n{3,}/g, '\n\n').trim()
        fullReply = collapseRepeatedPhrase(fullReply)
        fullReply = ensureCompleteReply(fullReply, message, collectedResults)
      } else {
        fullReply = streamedPathFullReply
      }

      const conversationId = await persistConversation(userId, body.conversation_id, message, fullReply, metadata)
      metadata.conversation_id = conversationId

      sendSSE('metadata', metadata)
      sendSSE('done', {})
      return res.end()
    }

    // --- Non-streaming path ---
    const choice = await runToolLoop()

    let reply = choice?.message?.content?.trim() ?? "I couldn't generate a reply. Please try rephrasing or use Support."
    reply = reply.replace(/\s*\[[^\]]*\]\([^)]*\)/g, '').replace(/\n{3,}/g, '\n\n').trim()
    reply = collapseRepeatedPhrase(reply)
    reply = ensureCompleteReply(reply, message, collectedResults)

    const metadata = buildResponseMetadata(collectedResults)

    const conversationId = await persistConversation(userId, body.conversation_id, message, reply, metadata)

    return res.json({
      reply,
      conversation_id: conversationId,
      ...metadata,
    })
  }),
)

async function persistConversation(userId, existingConvoId, userMessage, assistantReply, metadata) {
  try {
    let convoId = existingConvoId
    if (!convoId) {
      const { rows } = await pool.query(
        'insert into assistant_conversations (user_id) values ($1) returning id',
        [userId],
      )
      convoId = rows[0]?.id
    } else {
      await pool.query(
        'update assistant_conversations set updated_at = now() where id = $1',
        [convoId],
      ).catch(() => {})
    }
    if (!convoId) return null
    await pool.query(
      `insert into assistant_messages (conversation_id, role, content) values ($1, 'user', $2)`,
      [convoId, userMessage],
    )
    await pool.query(
      `insert into assistant_messages (conversation_id, role, content, metadata) values ($1, 'assistant', $2, $3)`,
      [convoId, assistantReply, JSON.stringify(metadata ?? {})],
    )
    return convoId
  } catch {
    return existingConvoId ?? null
  }
}

function buildResponseMetadata(collectedResults) {
    const dedup = (arr, key) => {
      const seen = new Set()
      return arr.filter((item) => {
        const k = item[key]
        if (!k || seen.has(k)) return false
        seen.add(k)
        return true
      })
    }

    const suggested_services = dedup(collectedResults.services, 'id').slice(0, 8).map((s) => ({
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

    const suggested_products = dedup(collectedResults.products, 'id').slice(0, 8).map((p) => ({
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

    const suggested_jobs = dedup(collectedResults.jobs, 'id').slice(0, 6).map((j) => ({
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

    const suggested_providers = dedup(collectedResults.providers, 'user_id').slice(0, 5).map((p) => ({
      user_id: p.user_id,
      name: p.name,
      verification_tier: p.verification_tier ?? 'unverified',
      service_area: p.service_area ?? null,
    }))

    const suggested_actions = dedup(collectedResults.actions, 'url')

    const hasServices = suggested_services.length > 0
    const hasProducts = suggested_products.length > 0
    const hasJobs = suggested_jobs.length > 0

    const card_order = hasServices
      ? ['services', 'products', 'jobs', 'providers']
      : hasProducts
        ? ['products', 'services', 'jobs', 'providers']
        : hasJobs
          ? ['jobs', 'services', 'products', 'providers']
          : ['services', 'products', 'jobs', 'providers']

    // Prefer model-generated contextual follow-ups over static ones
    let suggested_replies = collectedResults.followUps?.length
      ? collectedResults.followUps
      : []

    if (!suggested_replies.length) {
      if (hasServices || hasProducts) {
        suggested_replies.push('How do I post a job?', 'How does escrow work?')
      }
      if (hasJobs) {
        suggested_replies.push('How do I apply?', 'How does escrow work?')
      }
      if (!hasServices && !hasProducts && !hasJobs) {
        suggested_replies.push('What services are available?', 'Show me open jobs')
      }
    }

    return {
      suggested_products: suggested_products.length ? suggested_products : undefined,
      suggested_providers: suggested_providers.length ? suggested_providers : undefined,
      suggested_services: suggested_services.length ? suggested_services : undefined,
      suggested_jobs: suggested_jobs.length ? suggested_jobs : undefined,
      card_order,
      suggested_actions: suggested_actions.length ? suggested_actions : undefined,
      suggested_replies: [...new Set(suggested_replies)].slice(0, 4),
    }
}

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
    return res.json({ text: (transcription?.text || '').trim() })
  }),
)

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
    const speech = await openai.audio.speech.create({ model: 'tts-1', voice: 'onyx', input: text })
    const buffer = Buffer.from(await speech.arrayBuffer())
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    return res.send(buffer)
  }),
)
