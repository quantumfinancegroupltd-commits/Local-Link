import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { http } from '../../api/http.js'

/** Collapse repeated phrases to avoid repeated model output (e.g. "To list yourTo list your..."). */
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
import { useAuth } from '../../auth/useAuth.js'
import { imageProxySrc } from '../../lib/imageProxy.js'
import { transcribeAudio, speakText } from '../../lib/assistantVoice.js'
import { Button } from '../ui/FormControls.jsx'

/** Compact product card for assistant suggestion bubbles */
function AssistantProductCard({ product, onNavigate }) {
  const img = product?.image_url
  const [imgError, setImgError] = useState(false)
  const showImg = img && !imgError
  const price = product?.price != null ? `GHS ${Number(product.price)}` : ''
  const unit = product?.unit ? ` / ${product.unit}` : ''

  return (
    <Link
      to={`/marketplace/products/${product.id}`}
      onClick={onNavigate}
      className="flex min-w-0 shrink-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/50"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {showImg ? (
          <img
            src={imageProxySrc(img) || img}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-400/80 to-lime-400/80 text-xs font-semibold text-slate-800">
            {product?.name?.slice(0, 2)?.toUpperCase() ?? '—'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{product?.name ?? 'Produce'}</div>
        <div className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {price}
          {unit}
        </div>
        {product?.farmer_name ? (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">by {product.farmer_name}</div>
        ) : null}
        <div className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">View listing →</div>
      </div>
    </Link>
  )
}

/** Compact provider card for assistant suggestion bubbles */
function AssistantProviderCard({ provider, onNavigate }) {
  return (
    <Link
      to={`/u/${provider.user_id}`}
      onClick={onNavigate}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
        {provider?.name?.slice(0, 1)?.toUpperCase() ?? '?'}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{provider?.name ?? 'Provider'}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {provider?.verification_tier ?? 'unverified'}
          {provider?.service_area ? ` · ${provider.service_area}` : ''}
        </div>
      </div>
      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">View →</span>
    </Link>
  )
}

/** Compact service card for assistant (artisan_services: cleaning, plumbing, etc.) */
function AssistantServiceCard({ service, onNavigate }) {
  const price = service?.price != null ? `${service?.currency ?? 'GHS'} ${Number(service.price)}` : null
  const duration = service?.duration_minutes > 0 ? `${service.duration_minutes} min` : null
  return (
    <Link
      to={`/u/${service?.artisan_user_id}`}
      onClick={onNavigate}
      className="flex min-w-0 shrink-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-emerald-500/50"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-600 to-emerald-700 text-lg font-bold text-white">
        {service?.category?.slice(0, 1)?.toUpperCase() ?? 'S'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{service?.title ?? 'Service'}</div>
        <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
          {service?.artisan_name ?? 'Provider'}
          {service?.service_area ? ` · ${service.service_area}` : ''}
        </div>
        {(price || duration) ? (
          <div className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {[price, duration].filter(Boolean).join(' · ')}
          </div>
        ) : null}
        <div className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">View & book →</div>
      </div>
    </Link>
  )
}

/** Compact job role card for assistant suggestion bubbles (employers / job seekers) */
function AssistantJobCard({ job, onNavigate }) {
  const hasPay = job.pay_min != null || job.pay_max != null
  const pay = hasPay
    ? `${job.currency || 'GHS'} ${[job.pay_min, job.pay_max].filter((x) => x != null).join('–')}${job.pay_period ? ` / ${job.pay_period}` : ''}`
    : null
  return (
    <Link
      to={`/jobs/${job.id}`}
      onClick={onNavigate}
      className="flex min-w-0 shrink-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-orange-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-orange-500/50"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-lg font-bold text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
        {job?.company_name?.slice(0, 1)?.toUpperCase() ?? '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{job?.title ?? 'Role'}</div>
        <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{job?.company_name ?? 'Company'}</div>
        {job?.location ? <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{job.location}</div> : null}
        {pay ? <div className="mt-1 text-xs font-medium text-orange-700 dark:text-orange-400">{pay}</div> : null}
        <div className="mt-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">View role →</div>
      </div>
    </Link>
  )
}

const SUGGESTED_GUEST = [
  'How does escrow work?',
  'How do I post a job?',
  'What are verification tiers?',
  'How do I withdraw money?',
  'What happens in a dispute?',
]

const SUGGESTED_BY_ROLE = {
  buyer: [
    'I need some groceries',
    'Looking for a plumber',
    'How does escrow work?',
    'How do I post a job?',
    'What happens in a dispute?',
  ],
  artisan: [
    'How do I get paid?',
    'What are verification tiers?',
    'How do I send a quote to a buyer?',
    'When can I withdraw money?',
    'What happens in a dispute?',
  ],
  farmer: [
    'How do I list produce?',
    'How does escrow work for orders?',
    'When do I get paid for an order?',
    'What are verification tiers?',
    'How do I withdraw money?',
  ],
  driver: [
    'How do I claim deliveries?',
    'How do I get paid for delivery?',
    'What are verification tiers?',
    'How does escrow work?',
  ],
  company: [
    'How do I post a job?',
    'How does escrow work for employers?',
    'How do I manage applicants?',
    'What are verification tiers?',
  ],
  admin: [
    'How do I resolve a dispute?',
    'Review open disputes',
    'View user metrics',
    'How does escrow release work for admins?',
  ],
  guest: [
    'I need some groceries',
    'Looking for a plumber',
    'Any jobs in Accra?',
    'How does escrow work?',
    'How do I post a job?',
  ],
}

function getSuggestedForRole(role) {
  return SUGGESTED_BY_ROLE[role] ?? SUGGESTED_GUEST
}

const ASSISTANT_STORAGE_KEY = 'locallink_assistant_messages'
const MAX_PERSISTED_MESSAGES = 30

function loadPersistedMessages() {
  try {
    const raw = localStorage.getItem(ASSISTANT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(-MAX_PERSISTED_MESSAGES)
  } catch {
    return []
  }
}

function savePersistedMessages(msgs) {
  try {
    const toSave = msgs.slice(-MAX_PERSISTED_MESSAGES).map((m) => ({
      role: m.role,
      content: m.content ?? '',
      suggestedProducts: m.suggestedProducts,
      suggestedProviders: m.suggestedProviders,
      suggestedServices: m.suggestedServices,
      suggestedJobs: m.suggestedJobs,
      card_order: m.card_order,
      suggested_actions: m.suggested_actions,
      suggested_replies: m.suggested_replies,
    }))
    localStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // ignore
  }
}

export function AssistantChat({ onClose, embedded = false }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState(loadPersistedMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [playingIndex, setPlayingIndex] = useState(null)
  const conversationIdRef = useRef(null)
  const bottomRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const prevMessageCountRef = useRef(0)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const recordingTimeoutRef = useRef(null)
  const [voiceReplyPendingPlay, setVoiceReplyPendingPlay] = useState(false)
  const suggested = getSuggestedForRole(user?.role ?? 'guest')

  // Only scroll to bottom when a new message is added *and* user was already near bottom (so scrolling up stays put)
  useEffect(() => {
    if (messages.length <= prevMessageCountRef.current) return
    const el = scrollContainerRef.current
    const wasNearBottom = el
      ? el.scrollHeight - el.scrollTop - el.clientHeight < 120
      : true
    prevMessageCountRef.current = messages.length
    if (wasNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    if (messages.length > 0) savePersistedMessages(messages)
  }, [messages])

  async function send(msg, options = {}) {
    const text = (typeof msg === 'string' ? msg : input).trim()
    if (!text) return
    setVoiceReplyPendingPlay(false)
    setInput('')
    setError(null)
    const userMsg = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content ?? '' }))
      const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
      const token = localStorage.getItem('locallink_token')
      const headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' }
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(`${baseURL}/assistant/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, history, conversation_id: conversationIdRef.current }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || `HTTP ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('text/event-stream')) {
        let streamedText = ''
        let metadata = {}
        const assistantIdx = { current: -1 }

        setMessages((m) => {
          assistantIdx.current = m.length
          return [...m, { role: 'assistant', content: '', _streaming: true }]
        })
        setLoading(false)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (!line.startsWith('event: ')) continue
            const event = line.slice(7).trim()
            const dataLine = lines[i + 1]
            if (!dataLine?.startsWith('data: ')) continue
            let data
            try { data = JSON.parse(dataLine.slice(6)) } catch { continue }
            if (!data) continue
            i += 1

            if (event === 'token') {
              streamedText += data.text || ''
              const finalText = collapseRepeatedPhrase(streamedText)
              setMessages((m) => m.map((msg, idx) =>
                idx === assistantIdx.current ? { ...msg, content: finalText } : msg,
              ))
            } else if (event === 'metadata') {
              metadata = data
              if (data.conversation_id) conversationIdRef.current = data.conversation_id
            } else if (event === 'done') {
              const finalContent = collapseRepeatedPhrase(streamedText)
              setMessages((m) => m.map((msg, idx) =>
                idx === assistantIdx.current
                  ? {
                      ...msg,
                      content: finalContent,
                      _streaming: false,
                      suggestedProducts: metadata.suggested_products || [],
                      suggestedProviders: metadata.suggested_providers || [],
                      suggestedServices: metadata.suggested_services || [],
                      suggestedJobs: metadata.suggested_jobs || [],
                      card_order: metadata.card_order || ['services', 'products', 'jobs', 'providers'],
                      suggested_actions: metadata.suggested_actions || [],
                      suggested_replies: metadata.suggested_replies || [],
                    }
                  : msg,
              ))
            }
          }
        }

        if (options.playReply && streamedText) {
          try { await speakText(streamedText); setVoiceReplyPendingPlay(false) }
          catch { setVoiceReplyPendingPlay(true) }
        }
      } else {
        const data = await response.json()
        if (data.conversation_id) conversationIdRef.current = data.conversation_id
        const reply = data?.reply ?? "Sorry, I couldn't get a response."
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: reply,
            suggestedProducts: data?.suggested_products || [],
            suggestedProviders: data?.suggested_providers || [],
            suggestedServices: data?.suggested_services || [],
            suggestedJobs: data?.suggested_jobs || [],
            card_order: data?.card_order || ['services', 'products', 'jobs', 'providers'],
            suggested_actions: data?.suggested_actions || [],
            suggested_replies: data?.suggested_replies || [],
          },
        ])
        if (options.playReply && reply) {
          try { await speakText(reply); setVoiceReplyPendingPlay(false) }
          catch { setVoiceReplyPendingPlay(true) }
        }
      }
    } catch (e) {
      const errMsg = e?.response?.data?.message ?? e?.message ?? 'Something went wrong.'
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${errMsg}. You can open a support ticket from this page.` }])
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current)
          recordingTimeoutRef.current = null
        }
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        blob.name = 'audio.webm'
        setTranscribing(true)
        try {
          const text = await transcribeAudio(blob)
          if (text) await send(text, { playReply: true })
          else setError('No speech detected. Try again.')
        } catch (e) {
          setError(e?.message ?? 'Voice input failed')
        } finally {
          setTranscribing(false)
        }
      }
      mr.start()
      setRecording(true)
      setError(null)
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording()
      }, 60_000)
    } catch (e) {
      setError(e?.message ?? 'Microphone access denied')
    }
  }

  function stopRecording() {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setRecording(false)
  }

  async function playMessage(index, content) {
    if (!content?.trim()) return
    setPlayingIndex(index)
    setVoiceReplyPendingPlay(false)
    try {
      await speakText(content)
    } catch {
      setError('Could not play audio')
    } finally {
      setPlayingIndex(null)
    }
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col bg-white dark:bg-transparent ${embedded ? 'rounded-2xl border border-slate-200 dark:border-white/10' : ''}`} style={embedded ? { minHeight: 360 } : undefined}>
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-emerald-100 ring-2 ring-emerald-200 dark:bg-emerald-900/50 dark:ring-emerald-700/50">
            <img
              src="/yao-avatar.png"
              alt=""
              className="h-full w-full object-cover object-top"
              onError={(e) => {
                e.target.style.display = 'none'
                const fallback = e.target.nextElementSibling
                if (fallback) fallback.classList.remove('hidden')
              }}
            />
            <div className="absolute inset-0 hidden flex items-center justify-center text-lg font-bold text-emerald-700" aria-hidden>
              Y
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">YAO</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Your LocalLink Guide · Ask me about jobs, hiring, deliveries, or payments</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([])
                setError(null)
                conversationIdRef.current = null
                try {
                  localStorage.removeItem(ASSISTANT_STORAGE_KEY)
                } catch {
                  // ignore
                }
              }}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              Clear chat
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3">
        {voiceReplyPendingPlay && messages.length > 0 && (
          <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Tap the speaker icon on YAO’s reply to hear it.
          </div>
        )}
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="mr-6">
              <div className="inline-block max-w-[85%] rounded-2xl bg-slate-100 px-4 py-2.5 text-sm text-slate-800 dark:bg-white/10 dark:text-slate-200">
                {user?.name ? (
                  <>Hi, {user.name.split(/\s+/)[0]}! I'm YAO. Ask me anything about jobs, hiring, deliveries, or payments—I'll help you get it done on LocalLink.</>
                ) : (
                  <>Hi, I'm YAO. Ask me anything about jobs, hiring, deliveries, or payments—I'll help you get it done on LocalLink.</>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggested.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === 'user' ? 'ml-6 text-right' : 'mr-6'}`}>
            <div className="inline-flex max-w-[85%] items-start gap-2">
              <div
                className={`rounded-2xl px-4 py-2 text-sm ${
                  msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-200'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'assistant' && msg.content && (
                <button
                  type="button"
                  onClick={() => playMessage(i, msg.content)}
                  disabled={playingIndex !== null}
                  className={`shrink-0 rounded-full p-1.5 disabled:opacity-50 ${
                    voiceReplyPendingPlay && i === messages.length - 1
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-800/50'
                      : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200'
                  }`}
                  aria-label="Play message"
                  title="Listen"
                >
                  {playingIndex === i ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                </button>
              )}
            </div>
            {msg.role === 'assistant' &&
              (msg.suggestedProducts?.length > 0 || msg.suggestedProviders?.length > 0 || msg.suggestedServices?.length > 0 || msg.suggestedJobs?.length > 0) && (
              <div className="mt-2 flex flex-col gap-3">
                {(msg.card_order || ['services', 'products', 'providers', 'jobs']).map((section) => {
                  if (section === 'products' && msg.suggestedProducts?.length > 0)
                    return (
                      <div key="products" className="flex gap-2 overflow-x-auto pb-1">
                        {msg.suggestedProducts.map((p) => (
                          <div key={p.id} className="w-[220px] shrink-0">
                            <AssistantProductCard product={p} onNavigate={onClose} />
                          </div>
                        ))}
                      </div>
                    )
                  if (section === 'services' && msg.suggestedServices?.length > 0)
                    return (
                      <div key="services" className="flex gap-2 overflow-x-auto pb-1">
                        {msg.suggestedServices.map((s) => (
                          <div key={s.id} className="w-[240px] shrink-0">
                            <AssistantServiceCard service={s} onNavigate={onClose} />
                          </div>
                        ))}
                      </div>
                    )
                  if (section === 'providers' && msg.suggestedProviders?.length > 0)
                    return (
                      <div key="providers" className="flex flex-wrap gap-2">
                        {msg.suggestedProviders.map((p) => (
                          <AssistantProviderCard key={p.user_id} provider={p} onNavigate={onClose} />
                        ))}
                      </div>
                    )
                  if (section === 'jobs' && msg.suggestedJobs?.length > 0)
                    return (
                      <div key="jobs" className="flex gap-2 overflow-x-auto pb-1">
                        {msg.suggestedJobs.map((j) => (
                          <div key={j.id} className="w-[240px] shrink-0">
                            <AssistantJobCard job={j} onNavigate={onClose} />
                          </div>
                        ))}
                      </div>
                    )
                  return null
                })}
              </div>
            )}
            {msg.role === 'assistant' && (msg.suggested_actions?.length > 0 || msg.suggested_replies?.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {msg.suggested_actions?.map((a) => (
                  <Link
                    key={a.url}
                    to={a.url}
                    onClick={onClose}
                    className="inline-flex items-center rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/50 dark:bg-white/5 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                  >
                    {a.label}
                  </Link>
                ))}
                {msg.suggested_replies?.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => send(r)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/20 dark:hover:text-emerald-200"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="mb-3 mr-6">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-white/10 dark:text-slate-400">
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '300ms' }} />
              </span>
              YAO is thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-slate-200 dark:border-white/10 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <div className="flex gap-2">
          {recording ? (
            <>
              <span className="flex flex-1 items-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-300">Recording… Tap Stop when done</span>
              <Button type="button" onClick={stopRecording} disabled={transcribing} className="bg-red-600 text-white hover:bg-red-700">
                Stop & send
              </Button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type or tap mic to speak…"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-400"
                disabled={loading || transcribing}
                maxLength={2000}
              />
              <button
                type="button"
                onClick={startRecording}
                disabled={loading || transcribing}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                aria-label="Record voice message"
                title="Speak"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
              </button>
              <Button type="submit" disabled={loading || transcribing || !input.trim()}>
                {transcribing ? '…' : 'Send'}
              </Button>
            </>
          )}
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  )
}
