import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http.js'
import { useAuth } from '../../auth/useAuth.js'
import { Button, Card, Input } from '../../components/ui/FormControls.jsx'
import { NextStepBanner } from '../../components/ui/NextStepBanner.jsx'
import { PageHeader } from '../../components/ui/PageHeader.jsx'

function looksLikePhoneNumber(text) {
  const s = String(text ?? '')
  // Keep consistent with backend (anti-leakage, not perfect parsing).
  const phoneLike = /(\+?233|0)?[\s-]?\d[\d\s-]{6,}\d/g
  let m
  // eslint-disable-next-line no-cond-assign
  while ((m = phoneLike.exec(s))) {
    const digits = String(m[0]).replace(/\D/g, '')
    if (digits.length >= 8) return true
  }
  return false
}

export function MessagesThread() {
  const { user } = useAuth()
  const { type, id } = useParams() // type = job|order|jobpost
  const [params] = useSearchParams()
  const withWho = params.get('with') || undefined

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [policyInfo, setPolicyInfo] = useState(null)

  const listRef = useRef(null)

  const endpoint = useMemo(() => {
    if (type === 'job') return `/messages/jobs/${id}`
    if (type === 'order') return withWho ? `/messages/orders/${id}?with=${encodeURIComponent(withWho)}` : `/messages/orders/${id}`
    if (type === 'jobpost') return withWho ? `/messages/job-posts/${id}?with=${encodeURIComponent(withWho)}` : `/messages/job-posts/${id}`
    return null
  }, [type, id, withWho])

  async function load() {
    if (!endpoint) return
    setLoading(true)
    setError(null)
    try {
      const res = await http.get(endpoint)
      const msgs = res.data?.messages ?? []
      setMessages(Array.isArray(msgs) ? msgs : [])
      setTimeout(() => {
        listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: 'smooth' })
      }, 50)
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  // Simple polling while open
  useEffect(() => {
    if (!endpoint) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint])

  async function send() {
    const msg = text.trim()
    if (!msg) return
    if (!endpoint) return

    const phoneRisk = looksLikePhoneNumber(msg)
    if (phoneRisk) {
      const ok = window.confirm(
        'Policy warning:\n\nIt looks like your message contains a phone number.\n\nFor safety, LocalLink masks phone numbers and logs repeated attempts.\n\nSend anyway?',
      )
      if (!ok) return
    }

    setBusy(true)
    try {
      if (type === 'job') {
        await http.post(`/messages/jobs/${id}`, { message: msg })
      } else if (type === 'jobpost') {
        const qs = withWho ? `?with=${encodeURIComponent(withWho)}` : ''
        await http.post(`/messages/job-posts/${id}${qs}`, { message: msg })
      } else {
        await http.post(`/messages/orders/${id}`, { message: msg, to: withWho })
      }
      setText('')
      if (phoneRisk) setPolicyInfo('Phone numbers are masked in chat for safety. Please keep payments and coordination in-app.')
      await load()
    } catch (err) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to send message')
    } finally {
      setBusy(false)
    }
  }

  const phoneWarning = useMemo(() => looksLikePhoneNumber(text), [text])

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title="Chat"
        subtitle={`${type?.toUpperCase() || ''} • ${id?.slice(0, 8) || ''}${withWho ? ` • with ${withWho}` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={load} disabled={loading || busy}>
              Refresh
            </Button>
            <Link to="/messages">
              <Button variant="secondary">Back</Button>
            </Link>
          </>
        }
      />

      {phoneWarning ? (
        <NextStepBanner
          variant="warning"
          title="Policy: phone numbers are blocked in chat"
          description="For your safety, keep communication and payments on LocalLink. Phone numbers will be masked and repeated attempts can reduce trust."
        />
      ) : policyInfo ? (
        <NextStepBanner
          variant="info"
          title="Safety reminder"
          description={policyInfo}
          actions={
            <Button variant="secondary" onClick={() => setPolicyInfo(null)}>
              Dismiss
            </Button>
          }
        />
      ) : null}

      <Card className="p-0">
        {loading ? (
          <div className="p-5 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="p-5 text-sm text-red-700">{error}</div>
        ) : (
          <>
            <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-5 space-y-3">
              {messages.length === 0 ? (
                <div className="text-sm text-slate-600">No messages yet.</div>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                      <div
                        className={[
                          'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                          mine ? 'bg-slate-900 text-white' : 'border bg-white text-slate-900',
                        ].join(' ')}
                      >
                        <div className="whitespace-pre-wrap">{m.message}</div>
                        <div className={['mt-1 text-[11px] opacity-80', mine ? 'text-white' : 'text-slate-500'].join(' ')}>
                          {new Date(m.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message…"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send()
                    }
                  }}
                />
                <Button disabled={busy} onClick={send}>
                  Send
                </Button>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Updates every ~5 seconds while this chat is open.
                {phoneWarning ? <span className="ml-2 text-amber-700">Phone numbers will be masked.</span> : null}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}


