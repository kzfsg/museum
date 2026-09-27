// One AudioContext for the whole app, unlocked by the user's first tap so
// sound can start later without another one (browsers, iOS especially, only
// let a page start audio during a tap).

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

let ctx: AudioContext | null = null

export function audioContext(): AudioContext {
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext!
    ctx = new Ctx()
  }
  return ctx
}

// A tenth of a second of silence as an 8 kHz, 8-bit mono WAV.
function silence(): string {
  const samples = 800
  const view = new DataView(new ArrayBuffer(44 + samples))
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 8000, true)
  view.setUint32(28, 8000, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, samples, true)
  // 8-bit PCM is unsigned; 128 is the zero line.
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128)
  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }))
}

// iOS mutes Web Audio when the ringer switch is on silent, unlike media
// playback. Ask for a media session; older iOS switches to one when an audio
// element plays during a tap.
function preferMediaPlayback(): void {
  const nav = navigator as AudioSessionNavigator
  try {
    if (nav.audioSession) nav.audioSession.type = 'playback'
  } catch {}
  const url = silence()
  const el = new Audio(url)
  el.setAttribute('playsinline', '')
  void el
    .play()
    .catch(() => {})
    .finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000))
}

let installed = false

// Call once on load. The next tap anywhere unlocks audio for the session, and
// later taps bring it back if iOS pauses it (starting the camera or a call can).
export function unlockAudioOnFirstTap(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  let media = false
  const unlock = () => {
    const c = audioContext()
    if (c.state === 'running') return
    if (!media) {
      media = true
      preferMediaPlayback()
    }
    void c.resume().catch(() => {})
  }
  for (const e of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(e, unlock, true)
  const c = audioContext()
  // Once it has run, try to come back from interruptions without waiting for a tap.
  let ran = false
  c.addEventListener('statechange', () => {
    if (c.state === 'running') ran = true
    else if (ran && c.state !== 'closed' && document.visibilityState === 'visible') void c.resume().catch(() => {})
  })
  document.addEventListener('visibilitychange', () => {
    if (ran && document.visibilityState === 'visible' && c.state !== 'running') void c.resume().catch(() => {})
  })
}

export function audioUnlocked(): boolean {
  return ctx?.state === 'running'
}

// Resolves once audio can play (immediately if it already can).
export function whenAudioUnlocked(): Promise<void> {
  const c = audioContext()
  if (c.state === 'running') return Promise.resolve()
  return new Promise((resolve) => {
    const check = () => {
      if (c.state !== 'running') return
      c.removeEventListener('statechange', check)
      resolve()
    }
    c.addEventListener('statechange', check)
  })
}
