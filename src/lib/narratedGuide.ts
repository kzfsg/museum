import { LiveGuide, type GuideCallbacks } from './liveGuide'
import type { GuideScene } from './guide'

export type GuideProvider = 'elevenlabs' | 'openai'
// Adapts short ElevenLabs narrations to the existing view-aware guide controls.
// LiveGuide remains the conversational fallback. No keys reach the browser.
export class NarratedGuide {
  private audio = new Audio()
  private live: LiveGuide | null = null
  private scene: GuideScene | null = null
  private closed = false
  private controller = new AbortController()
  private version = 0
  private objectUrl: string | null = null
  private cache = new Map<string, Blob>()
  private muted = false

  constructor(private callbacks: GuideCallbacks, private onProvider: (provider: GuideProvider) => void) {
    this.audio.setAttribute('playsinline', '')
    // A real, silent WAV unlocks this audio element during the user's tap on iOS.
    this.audio.src = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
    void this.audio.play().catch(() => {})
  }

  async start(scene: GuideScene): Promise<void> {
    this.scene = scene
    this.callbacks.onStatus('connecting')
    try {
      const response = await fetch('/api/narration', { signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]) })
      const config = response.ok ? await response.json() : { available: false }
      if (this.closed) return
      if (!config.available || !scene.tidbits.length) return this.fallback()
      this.onProvider('elevenlabs')
      this.callbacks.onStatus('live')
    } catch {
      if (!this.closed) await this.fallback()
    }
  }

  tell(content: string, speak = false): void {
    if (this.live) return this.live.tell(content, speak)
    if (!speak || this.closed || !this.scene) return
    const tidbit = this.scene.tidbits.find(t => content.includes(`Right in front of them: ${t.title}.`))
      ?? this.scene.tidbits.find(t => content.includes(t.title)) ?? this.scene.tidbits[0]
    if (tidbit) void this.narrate(tidbit)
  }

  private async narrate(tidbit: GuideScene['tidbits'][number]): Promise<void> {
    const version = ++this.version
    this.audio.pause()
    try {
      const key = JSON.stringify(tidbit)
      let blob = this.cache.get(key)
      if (!blob) {
        const response = await fetch('/api/narration', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: this.scene!.year, tidbit }), signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(25_000)]),
        })
        if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Narration unavailable')
        blob = await response.blob()
        if (this.closed || version !== this.version) return
        this.cache.set(key, blob)
      }
      if (this.closed || version !== this.version) return
      this.releaseUrl()
      this.objectUrl = URL.createObjectURL(blob)
      this.audio.src = this.objectUrl
      this.audio.muted = this.muted
      this.callbacks.onCaption(tidbit.narration || `${tidbit.title}. ${tidbit.body}`)
      await this.audio.play()
    } catch {
      if (!this.closed && version === this.version) await this.fallback()
    }
  }

  private async fallback(): Promise<void> {
    if (this.closed || this.live || !this.scene) return
    ++this.version
    this.audio.pause()
    this.releaseUrl()
    this.onProvider('openai')
    this.live = new LiveGuide(this.callbacks)
    this.live.setMuted(this.muted)
    await this.live.start(this.scene)
  }

  setMuted(value: boolean): void {
    this.muted = value
    this.audio.muted = value
    this.live?.setMuted(value)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    ++this.version
    this.controller.abort()
    this.live?.close()
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.releaseUrl()
    this.cache.clear()
    this.callbacks.onStatus('closed')
  }

  private releaseUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = null
  }
}
