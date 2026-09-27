'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Place } from '@/src/data/places'
import { describeView, newViewTracker, sceneFromPlace, summarizeView, viewUpdate } from '@/src/lib/guide'
import { type GuideStatus } from '@/src/lib/liveGuide'
import { NarratedGuide, type GuideProvider } from '@/src/lib/narratedGuide'
import { angleDiff } from '@/src/lib/motion'
import type { ViewHandle } from '@/src/lib/viewSync'

const POLL_MS = 400
// The view counts as settled once it moves less than this between polls, so
// sweeping past a landmark doesn't set the guide talking about it.
const SETTLED_DEG = 4
// Captions show only the tail of what the guide is saying.
const CAPTION_CHARS = 200

function captionTail(text: string): string {
  if (text.length <= CAPTION_CHARS) return text
  const tail = text.slice(-CAPTION_CHARS)
  return `…${tail.slice(tail.indexOf(' ') + 1)}`
}

export interface TourGuide {
  provider: GuideProvider | null
  narrate: (title: string) => void
  status: GuideStatus | 'off'
  error: string | null
  caption: string
  muted: boolean
  toggle: () => void
  toggleMute: () => void
}

// A voice guide for the place on screen, told what the visitor faces as they
// look around `viewer`.
export function useTourGuide(place: Place, viewer: RefObject<ViewHandle | null>): TourGuide {
  const [status, setStatus] = useState<GuideStatus | 'off'>('off')
  const [error, setError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [muted, setMuted] = useState(false)
  const [provider, setProvider] = useState<GuideProvider | null>(null)
  const guide = useRef<NarratedGuide | null>(null)

  const stop = useCallback(() => {
    guide.current?.close()
    guide.current = null
    setStatus('off')
    setProvider(null)
    setCaption('')
    setMuted(false)
  }, [])

  const toggle = useCallback(() => {
    if (guide.current) return stop()
    setError(null)
    const scene = sceneFromPlace(place)
    const g: NarratedGuide = new NarratedGuide({
      onStatus: (s, message) => {
        if (guide.current !== g) return
        if (s === 'error') {
          g.close()
          guide.current = null
          setProvider(null)
          setError(message ?? 'The guide stopped')
          setStatus('off')
          return
        }
        setStatus(s)
        if (s === 'live') {
          const v = viewer.current
          const opening = v ? describeView(summarizeView(scene, v.getYaw(), v.getHfov())) : ''
          g.tell(`${opening} Greet the visitor in one sentence and point out what's in front of them.`, true)
        }
      },
      onCaption: (text) => guide.current === g && setCaption(captionTail(text)),
    }, (next) => guide.current === g && setProvider(next))
    guide.current = g
    void g.start(scene)
  }, [place, viewer, stop])

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      guide.current?.setMuted(!m)
      return !m
    })
  }, [])

  // While live, keep the guide up to date with where the visitor is looking.
  useEffect(() => {
    if (status !== 'live') return
    const scene = sceneFromPlace(place)
    const tracker = newViewTracker()
    const v0 = viewer.current
    // The greeting already described the starting view.
    if (v0) viewUpdate(tracker, scene, v0.getYaw(), v0.getHfov())
    let lastYaw: number | null = null
    const timer = setInterval(() => {
      const v = viewer.current
      if (!v) return
      const yaw = v.getYaw()
      const settled = lastYaw !== null && Math.abs(angleDiff(yaw, lastYaw)) < SETTLED_DEG
      lastYaw = yaw
      if (!settled) return
      const update = viewUpdate(tracker, scene, yaw, v.getHfov())
      if (update) guide.current?.tell(update.text, update.speak)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [status, place, viewer])

  // Hang up when leaving the place or the screen.
  useEffect(() => stop, [place, stop])

  const narrate = useCallback((title: string) => {
    guide.current?.tell(`Right in front of them: ${title}. Briefly describe this hotspot.`, true)
  }, [])

  return { status, error, caption, muted, toggle, toggleMute, provider, narrate }
}
