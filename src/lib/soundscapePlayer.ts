// Plays a soundscape mix in the browser with Web Audio. Recordings are decoded
// into buffers so sounds can start later without a tap (iOS only lets a page
// start audio during one, and unlocks an AudioContext for good once resumed).
// Beds loop with a crossfaded seam; accents play every so often.

import { LAYERS, layerUrl, type LayerId, type SoundscapeMix } from '@/src/lib/soundscape'

// Beds loop this much of their recording; accents play this long.
const BED_SECONDS = 40
const ACCENT_SECONDS = 16
const SEAM_SECONDS = 1.5
const FADE_SECONDS = 2
const ACCENT_GAP = { min: 12, max: 40 }
// How far the soundscape drops while the tour guide is on.
const DUCKED = 0.3
const MASTER = 0.8

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext }

// A copy of `length` seconds from a random point, with its end blended into
// its start so it loops without a click.
function loopableSlice(ctx: AudioContext, src: AudioBuffer, seconds: number): AudioBuffer {
  const rate = src.sampleRate
  const seam = Math.floor(SEAM_SECONDS * rate)
  const length = Math.min(Math.floor(seconds * rate), src.length - seam)
  if (length <= seam) return src
  const start = Math.floor(Math.random() * (src.length - length - seam))
  const out = ctx.createBuffer(src.numberOfChannels, length, rate)
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const from = src.getChannelData(ch)
    const to = out.getChannelData(ch)
    to.set(from.subarray(start, start + length))
    for (let i = 0; i < seam; i++) {
      const t = i / seam
      to[i] = from[start + i] * t + from[start + length + i] * (1 - t)
    }
  }
  return out
}

export class SoundscapePlayer {
  private ctx: AudioContext
  private master: GainNode
  private stops: (() => void)[] = []
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private ducked = false
  private closed = false
  // Bumped on every play/stop so a slow load for an old mix doesn't start.
  private generation = 0

  // Create inside a tap so iOS lets it make sound.
  constructor() {
    const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext!
    this.ctx = new Ctx()
    void this.ctx.resume()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.ctx.destination)
  }

  async play(mix: SoundscapeMix): Promise<void> {
    this.stopLayers()
    const generation = ++this.generation
    const loaded = await Promise.all(mix.layers.map(async (l) => ({ ...l, buffer: await this.load(l.id) })))
    if (this.closed || generation !== this.generation) return
    for (const { id, volume, buffer } of loaded) {
      if (!buffer) continue
      if (LAYERS[id].kind === 'bed') this.startBed(buffer, volume)
      else this.scheduleAccent(buffer, volume, generation, 2 + Math.random() * 6)
    }
    this.rampMaster(this.level(), FADE_SECONDS)
  }

  setDucked(ducked: boolean): void {
    this.ducked = ducked
    if (this.generation) this.rampMaster(this.level(), 0.6)
  }

  stop(): void {
    this.generation++
    this.rampMaster(0, 0.5)
    const stops = this.stops
    this.stops = []
    setTimeout(() => stops.forEach((s) => s()), 600)
  }

  close(): void {
    if (this.closed) return
    this.stop()
    this.closed = true
    setTimeout(() => void this.ctx.close().catch(() => {}), 700)
  }

  private level(): number {
    return MASTER * (this.ducked ? DUCKED : 1)
  }

  private rampMaster(value: number, seconds: number): void {
    const g = this.master.gain
    const now = this.ctx.currentTime
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
    g.linearRampToValueAtTime(value, now + seconds)
  }

  private stopLayers(): void {
    this.stops.forEach((s) => s())
    this.stops = []
  }

  // Decoded once per layer; beds and accents keep only the slice they play.
  private load(id: LayerId): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id)
    if (!p) {
      p = fetch(layerUrl(id))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
        .then((data) => this.ctx.decodeAudioData(data))
        .then((full) => loopableSlice(this.ctx, full, LAYERS[id].kind === 'bed' ? BED_SECONDS : ACCENT_SECONDS))
        .catch((e) => {
          console.warn(`[soundscape] couldn't load ${id}`, e)
          this.buffers.delete(id)
          return null
        })
      this.buffers.set(id, p)
    }
    return p
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
      source.stop()
      source.disconnect()
    })
  }

  private scheduleAccent(buffer: AudioBuffer, volume: number, generation: number, delaySeconds: number): void {
    const timer = setTimeout(() => {
      if (this.closed || generation !== this.generation) return
      const source = this.ctx.createBufferSource()
      source.buffer = buffer
      const gain = this.ctx.createGain()
      const now = this.ctx.currentTime
      const end = now + buffer.duration
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(volume, now + FADE_SECONDS)
      gain.gain.setValueAtTime(volume, end - FADE_SECONDS)
      gain.gain.linearRampToValueAtTime(0, end)
      source.connect(gain).connect(this.master)
      source.start(now)
      source.onended = () => source.disconnect()
      this.stops.push(() => {
        try {
          source.stop()
        } catch {}
      })
      const gap = ACCENT_GAP.min + Math.random() * (ACCENT_GAP.max - ACCENT_GAP.min)
      this.scheduleAccent(buffer, volume, generation, buffer.duration + gap)
    }, delaySeconds * 1000)
    this.stops.push(() => clearTimeout(timer))
  }
}
