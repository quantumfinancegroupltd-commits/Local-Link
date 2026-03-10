/**
 * YAO voice: transcribe (Whisper) and speak (TTS) via backend.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export async function transcribeAudio(blob) {
  const form = new FormData()
  form.append('audio', blob, blob.name || 'audio.webm')
  const token = localStorage.getItem('locallink_token')
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${baseURL}/assistant/transcribe`, {
    method: 'POST',
    headers,
    body: form,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data?.message || ''
    if (res.status === 503 && (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('voice'))) {
      throw new Error("Voice isn't available on this server. Ask your admin to add OPENAI_API_KEY to the API environment.")
    }
    throw new Error(msg || 'Transcription failed')
  }
  const data = await res.json()
  return (data?.text || '').trim()
}

export async function speakText(text) {
  if (!text || !text.trim()) return
  const token = localStorage.getItem('locallink_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${baseURL}/assistant/speak`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: text.slice(0, 4096) }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg = data?.message || ''
    if (res.status === 503 && (msg.toLowerCase().includes('not configured') || msg.toLowerCase().includes('voice'))) {
      throw new Error("Voice isn't available on this server. Ask your admin to add OPENAI_API_KEY to the API environment.")
    }
    throw new Error(msg || 'Speech failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  await new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    audio.onerror = reject
    audio.play().catch(reject)
  })
}
