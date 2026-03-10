import { useState, useEffect, useRef } from 'react'

/**
 * Full-screen video call view with the AI assistant (YAO) as a Meta Human.
 * User can have face-to-face communication; backend Meta Human / WebRTC can be wired later.
 */
export function AssistantVideoCall({ onEndCall }) {
  const [muted, setMuted] = useState(false)
  const [connecting, setConnecting] = useState(true)
  const localVideoRef = useRef(null)
  const [localStream, setLocalStream] = useState(null)

  useEffect(() => {
    let stream = null
    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        setLocalStream(stream)
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch {
        // No camera/mic or permission denied — continue without local video
      }
      // Simulate connection delay for Meta Human stream
      const t = setTimeout(() => setConnecting(false), 1500)
      return () => clearTimeout(t)
    }
    init()
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Video call with YAO</p>
            <p className="text-xs text-slate-400">Meta Human · Face to face</p>
          </div>
        </div>
      </div>

      {/* Main area: Meta Human (remote) + local self-view */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center p-4">
        {/* Remote: YAO as Meta Human */}
        <div className="absolute inset-4 flex items-center justify-center rounded-2xl bg-slate-800/80 overflow-hidden">
          {connecting ? (
            <div className="flex flex-col items-center gap-4 text-slate-400">
              <div className="h-12 w-12 animate-pulse rounded-full bg-emerald-500/30" />
              <p className="text-sm">Connecting to YAO…</p>
              <p className="text-xs">Preparing Meta Human</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 text-center max-w-sm">
              <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-emerald-500/40 bg-slate-700 ring-4 ring-emerald-500/20">
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
                <div className="absolute inset-0 hidden flex items-center justify-center bg-slate-700 text-4xl font-bold text-emerald-400">
                  Y
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold text-white">YAO</p>
                <p className="text-sm text-slate-400">Your LocalLink Guide · Meta Human</p>
                <p className="mt-2 text-xs text-slate-500">Face-to-face mode. Say hello — we’ll add live voice and lip-sync here.</p>
              </div>
            </div>
          )}
        </div>

        {/* Local self-view (picture-in-picture) */}
        <div className="absolute right-4 top-4 h-32 w-40 rounded-xl border-2 border-white/20 bg-slate-800 overflow-hidden shadow-xl">
          {localStream ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs">
              Camera off
            </div>
          )}
          <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">You</div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="shrink-0 flex items-center justify-center gap-4 border-t border-white/10 bg-black/40 px-4 py-4 backdrop-blur">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className={`flex h-12 w-12 items-center justify-center rounded-full transition ${muted ? 'bg-red-500/80 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={onEndCall}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-500 transition"
          aria-label="End call"
        >
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m0 0l-2 2m0 0l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.143-1.652a1 1 0 00-1.18.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.18L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
