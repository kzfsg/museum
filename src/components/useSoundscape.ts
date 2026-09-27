'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SoundscapeRequest, SoundscapeResponse } from '@/app/api/soundscape/route'
import type { Place } from '@/src/data/places'
import { fallbackMix, type SoundscapeMix } from '@/src/lib/soundscape'
import { SoundscapePlayer } from '@/src/lib/soundscapePlayer'

export interface Soundscape {
  status: 'off' | 'loading' | 'on'
  caption: string | null
  toggle: () => void
}

// Asks the server how this scene sounds. Raw scans (a blob: URL the server
// can't see) and failures get the era's typical mix.
async function fetchMix(place: Place): Promise<SoundscapeMix> {
  if (!place.panorama.startsWith('/') && !place.panorama.startsWith('data:image/')) return fallbackMix(place.year)
  try {
    const body: SoundscapeRequest = {
      image: place.panorama,
      year: place.year,
      name: place.name,
      neighborhood: place.neighborhood,
      note: place.note,
      tidbits: place.tidbits.map((t) => t.title),
    }
    const res = await fetch('/api/soundscape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return (await res.json()) as SoundscapeResponse
  } catch {
    return fallbackMix(place.year)
  }
}

// The period soundscape for the place on screen. The mix is worked out as
// soon as the place opens, so tapping play is quick; `ducked` quiets it while
// the tour guide talks.
export function useSoundscape(place: Place, ducked: boolean): Soundscape {
  const [status, setStatus] = useState<Soundscape['status']>('off')
  const [caption, setCaption] = useState<string | null>(null)
  const mix = useRef<Promise<SoundscapeMix> | null>(null)
  const player = useRef<SoundscapePlayer | null>(null)

  useEffect(() => {
    mix.current = fetchMix(place)
    return () => {
      player.current?.close()
      player.current = null
      mix.current = null
      setStatus('off')
      setCaption(null)
    }
  }, [place])

  useEffect(() => {
    player.current?.setDucked(ducked)
  }, [ducked])

  const toggle = useCallback(() => {
    if (player.current) {
      player.current.close()
      player.current = null
      setStatus('off')
      setCaption(null)
      return
    }
    const p = new SoundscapePlayer()
    p.setDucked(ducked)
    player.current = p
    setStatus('loading')
    const pending = mix.current ?? fetchMix(place)
    void pending
      .then(async (m) => {
        if (player.current !== p) return
        setCaption(m.caption)
        await p.play(m)
        if (player.current === p) setStatus('on')
      })
      .catch(() => player.current === p && setStatus('off'))
  }, [place, ducked])

  return { status, caption, toggle }
}
