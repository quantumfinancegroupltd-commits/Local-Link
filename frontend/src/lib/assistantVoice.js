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

let currentSpeechAudio = null
let currentSpeechUrl = null

export async function speakText(text) {
  if (!text || !text.trim()) return
  // Stop any already playing speech so we don't get double audio
  if (currentSpeechAudio) {
    try {
      currentSpeechAudio.pause()
      currentSpeechAudio.currentTime = 0
    } catch {}
    if (currentSpeechUrl) try { URL.revokeObjectURL(currentSpeechUrl) } catch {}
    currentSpeechAudio = null
    currentSpeechUrl = null
  }
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
  currentSpeechUrl = url
  const audio = new Audio(url)
  currentSpeechAudio = audio
  await new Promise((resolve, reject) => {
    audio.onended = () => {
      if (currentSpeechAudio === audio) {
        currentSpeechAudio = null
        currentSpeechUrl = null
      }
      URL.revokeObjectURL(url)
      resolve()
    }
    audio.onerror = (e) => {
      if (currentSpeechAudio === audio) {
        currentSpeechAudio = null
        currentSpeechUrl = null
      }
      URL.revokeObjectURL(url)
      reject(e)
    }
    audio.play().catch(reject)
  })
}
