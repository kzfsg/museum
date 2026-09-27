type AudioSession = { type: string }
let owner: symbol | null = null

// Safari can retain an explicit playback-only category after an app update.
// Select a capture-compatible category before requesting the microphone.
export function beginGuideAudioSession(): () => void {
  const session = (navigator as Navigator & { audioSession?: AudioSession }).audioSession
  if (!session) return () => {}
  const token = Symbol('guide')
  try {
    session.type = 'play-and-record'
    owner = token
  } catch {
    // The API is optional; browsers without a working setter manage this themselves.
    return () => {}
  }
  return () => {
    // A previous tour's delayed cleanup must not reset a newer tour's session.
    if (owner !== token) return
    owner = null
    try {
      if (session.type === 'play-and-record') session.type = 'auto'
    } catch {}
  }
}
