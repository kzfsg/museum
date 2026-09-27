// Plays a soundscape mix with Web Audio on the app's shared AudioContext
// (src/lib/audio.ts), so it can start as soon as a scene opens once the user
// has tapped anything. Recordings are decoded into buffers: beds loop with a
// crossfaded seam and never stop, so there's never silence; accents (a bell,
// a passing trolley) come every so often, each at its own realistic interval.

import { audioContext } from '@/src/lib/audio'
import { LAYERS, layerUrl, type Layer, type LayerId, type SoundscapeMix } from '@/src/lib/soundscape'

// Beds loop up to this much of their recording before repeating (longer means
// less noticeable repetition, but more memory); accents play this long.
const BED_SECONDS = 60
const SEAM_SECONDS = 2
const FADE_SECONDS = 0.8
const ACCENT_FADE_SECONDS = 2
const MASTER = 0.8

// A mono copy of up to `seconds` from a random point, with its end blended
// into its start so it loops without a click. Mono keeps phones' memory in
// check (a decoded minute of stereo is ~23 MB); ambience doesn't need stereo.
export function loopableSlice(ctx: Pick<BaseAudioContext, 'createBuffer'>, src: AudioBuffer, seconds: number): AudioBuffer {
  const rate = src.sampleRate
  const seam = Math.floor(SEAM_SECONDS * rate)
  const length = Math.max(1, Math.min(Math.floor(seconds * rate), src.length - seam))
  const loops = length > seam
  const start = loops ? Math.floor(Math.random() * (src.length - length - seam + 1)) : 0
  const out = ctx.createBuffer(1, Math.min(length, src.length), rate)
  const to = out.getChannelData(0)
  const channels = Array.from({ length: src.numberOfChannels }, (_, ch) => src.getChannelData(ch))
  const at = (i: number) => channels.reduce((sum, c) => sum + c[i], 0) / channels.length
  for (let i = 0; i < to.length; i++) {
    const t = loops && i < seam ? i / seam : 1
    to[i] = at(start + i) * t + (t < 1 ? at(start + length + i) * (1 - t) : 0)
  }
  return out
}

// Decoded once per layer for the whole session, one at a time: decoding
// several long files at once can fail on a phone, silencing those layers.
const buffers = new Map<LayerId, Promise<AudioBuffer | null>>()
let decoding: Promise<unknown> = Promise.resolve()

export function loadLayer(id: LayerId): Promise<AudioBuffer | null> {
  let p = buffers.get(id)
  if (!p) {
    const ctx = audioContext()
    const data = fetch(layerUrl(id)).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
    const decoded = decoding.then(() => data).then((d) => ctx.decodeAudioData(d))
    decoding = decoded.catch(() => {})
    p = decoded
      .then((full) => loopableSlice(ctx, full, (LAYERS[id] as Layer).seconds ?? BED_SECONDS))
      .catch((e) => {
        console.warn(`[soundscape] couldn't load ${id}`, e)
        buffers.delete(id)
        return null
      })
    buffers.set(id, p)
  }
  return p
}

export class SoundscapePlayer {
  private ctx = audioContext()
  private master: GainNode
  private stops: (() => void)[] = []
  private on = true
  private closed = false

  constructor() {
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.ctx.destination)
  }

  // Loads every layer, then starts them together. Safe to call before audio
  // is unlocked: sources wait for the context to run.
  async play(mix: SoundscapeMix): Promise<void> {
    const loaded = await Promise.all(mix.layers.map(async (l) => ({ ...l, buffer: await loadLayer(l.id) })))
    if (this.closed) return
    for (const { id, volume, buffer } of loaded) {
      if (!buffer) continue
      if (LAYERS[id].kind === 'bed') this.startBed(buffer, volume)
      else {
        const every = (LAYERS[id] as Layer).every ?? [30, 90]
        // The first one comes sooner than usual, at a random point, so they don't all start together.
        this.scheduleAccent(buffer, volume, every, 3 + Math.random() * every[0])
      }
    }
    this.ramp(this.on ? MASTER : 0, FADE_SECONDS)
  }

  setOn(on: boolean): void {
    this.on = on
    this.ramp(on ? MASTER : 0, on ? FADE_SECONDS : 0.3)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.ramp(0, 0.4)
    const stops = this.stops
    this.stops = []
    setTimeout(() => {
      stops.forEach((s) => s())
      this.master.disconnect()
    }, 500)
  }

  private ramp(value: number, seconds: number): void {
    const g = this.master.gain
    const now = this.ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(value, now + seconds)
  }

  private startBed(buffer: AudioBuffer, volume: number): void {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = this.ctx.createGain()
    gain.gain.value = volume
    source.connect(gain).connect(this.master)
    source.start(0, Math.random() * buffer.duration)
    this.stops.push(() => {
      try {
        source.stop()
      } catch {}
      source.disconnect()
    })
  }

  private scheduleAccent(buffer: AudioBuffer, volume: number, every: [number, number], delaySeconds: number): void {
    const timer = setTimeout(() => {
      if (this.closed) return
      // Don't pile up accents while audio is still locked or the tab is asleep.
      if (this.ctx.state !== 'running') return this.scheduleAccent(buffer, volume, every, 1)
      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      const gain = this.ctx.createGain()
      const now = this.ctx.currentTime
      const end = now + buffer.duration
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + ACCENT_FADE_SECONDS)
      gain.gain.setValueAtTime(volume, end - ACCENT_FADE_SECONDS)
      gain.gain.linearRampToValueAtTime(0, end)
      source.connect(gain).connect(this.master)
      source.start(now)
      source.onended = () => source.disconnect()
      this.stops.push(() => {
        try {
          source.stop()
        } catch {}
      })
      const gap = every[0] + Math.random() * (every[1] - every[0])
      this.scheduleAccent(buffer, volume, every, buffer.duration + gap)
    }, delaySeconds * 1000)
    this.stops.push(() => clearTimeout(timer))
  }
}
