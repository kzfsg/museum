// Browser side of the voice tour guide: a GPT-Live session over WebRTC.
// Microphone and speaker ride on media tracks; JSON events (context updates,
// transcripts) go over the "oai-events" data channel. The session itself is
// created by /api/guide so the API key stays on the server.

import type { GuideResponse } from '@/app/api/guide/route'
import type { GuideScene } from '@/src/lib/guide'

export type GuideStatus = 'connecting' | 'live' | 'closed' | 'error'

export interface GuideCallbacks {
  onStatus: (status: GuideStatus, error?: string) => void
  // What the guide is saying, as it says it; reset when the visitor speaks.
  onCaption: (text: string) => void
}

const ICE_WAIT_MS = 3000

function iceGathered(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      if (pc.iceGatheringState !== 'complete') return
      pc.removeEventListener('icegatheringstatechange', done)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', done)
    // Some networks never report "complete"; the candidates so far are enough.
    setTimeout(resolve, ICE_WAIT_MS)
  })
}

export class LiveGuide {
  private pc: RTCPeerConnection | null = null
  private events: RTCDataChannel | null = null
  private mic: MediaStream | null = null
  private audio: HTMLAudioElement
  private caption = ''
  private started = false
  private closed = false

  // Create inside a tap: iOS only lets audio play that was started by one.
  constructor(private callbacks: GuideCallbacks) {
    this.audio = new Audio()
    this.audio.autoplay = true
    this.audio.setAttribute('playsinline', '')
    void this.audio.play().catch(() => {})
  }

  async start(scene: GuideScene): Promise<void> {
    this.callbacks.onStatus('connecting')
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      if (this.closed) return this.release()

      const pc = new RTCPeerConnection()
      this.pc = pc
      pc.addEventListener('track', (e) => {
        this.audio.srcObject = new MediaStream([e.track])
        void this.audio.play().catch(() => {})
      })
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed') this.fail('Lost the connection to the guide')
      })
      for (const track of this.mic.getAudioTracks()) pc.addTrack(track, this.mic)

      const events = pc.createDataChannel('oai-events')
      this.events = events
      events.addEventListener('message', (e) => this.handle(JSON.parse(e.data)))

      await pc.setLocalDescription(await pc.createOffer())
      await iceGathered(pc)

      const res = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: pc.localDescription!.sdp, scene }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
        throw new Error(error)
      }
      const { sdp } = (await res.json()) as GuideResponse
      if (this.closed) return this.release()
      await pc.setRemoteDescription({ type: 'answer', sdp })
    } catch (e) {
      const denied = e instanceof DOMException && e.name === 'NotAllowedError'
      this.fail(denied ? 'The guide needs your microphone' : e instanceof Error ? e.message : 'Couldn’t start the guide')
    }
  }

  // Tells the guide something. `speak` asks it to talk about it now; otherwise
  // it's quiet context that shapes what it says next.
  tell(content: string, speak = false): void {
    if (!this.started || this.events?.readyState !== 'open') return
    this.events.send(
      JSON.stringify({ type: speak ? 'session.commentary.append' : 'session.thinking.append', content, delegation_id: null })
    )
  }

  setMuted(muted: boolean): void {
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted))
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    if (this.events?.readyState === 'open') this.events.send(JSON.stringify({ type: 'session.close' }))
    // Give the close event a moment to go out before tearing down.
    setTimeout(() => this.release(), 300)
    this.callbacks.onStatus('closed')
  }

  private handle(event: { type: string; delta?: string; error?: { message?: string }; reason?: string }): void {
    switch (event.type) {
      case 'session.started':
        this.started = true
        this.callbacks.onStatus('live')
        break
      case 'session.output_transcript.delta':
        this.caption += event.delta ?? ''
        this.callbacks.onCaption(this.caption)
        break
      case 'session.input_transcript.delta':
        // The visitor is talking; the next thing the guide says is a new caption.
        this.caption = ''
        break
      case 'session.closed':
        if (!this.closed) this.fail(event.reason === 'expired' ? 'The guide session ended' : 'The guide hung up')
        break
      case 'error':
        console.warn('[guide]', event.error)
        if (!this.started) this.fail(event.error?.message ?? 'The guide couldn’t start')
        break
    }
  }

  private fail(message: string): void {
    if (this.closed) return
    this.closed = true
    this.release()
    this.callbacks.onStatus('error', message)
  }

  private release(): void {
    this.events?.close()
    this.pc?.close()
    this.mic?.getTracks().forEach((t) => t.stop())
    this.audio.srcObject = null
    this.pc = null
    this.events = null
    this.mic = null
  }
}
