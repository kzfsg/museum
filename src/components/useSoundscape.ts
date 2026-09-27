'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SoundscapeRequest, SoundscapeResponse } from '@/app/api/soundscape/route'
import type { Place } from '@/src/data/places'
import { audioContext, unlockAudioOnFirstTap, whenAudioUnlocked } from '@/src/lib/audio'
import { fallbackMix, type SoundscapeMix } from '@/src/lib/soundscape'
import { SoundscapePlayer } from '@/src/lib/soundscapePlayer'

const SOUND_OFF = 'museum.soundOff'

export interface Soundscape {
  // 'waiting': ready, but the browser needs a tap before it can play.
  status: 'loading' | 'waiting' | 'on' | 'off'
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

function savedOn(): boolean {
  try {
    return localStorage.getItem(SOUND_OFF) !== '1'
  } catch {
    return true
  }
}

// The period soundscape for the place on screen. It starts by itself as soon
// as the scene opens (once the user has tapped anything this session) and
// keeps going until they leave the scene or turn it off; the choice sticks.
export function useSoundscape(place: Place): Soundscape {
  const [on, setOn] = useState(true)
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [caption, setCaption] = useState<string | null>(null)
  const player = useRef<SoundscapePlayer | null>(null)

  useEffect(() => {
    unlockAudioOnFirstTap()
    setOn(savedOn())
    let live = true
    whenAudioUnlocked().then(() => live && setUnlocked(true))
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const p = new SoundscapePlayer()
    p.setOn(savedOn())
    player.current = p
    setReady(false)
    setCaption(null)
    let live = true
    void fetchMix(place)
      .then(async (mix) => {
        if (!live) return
        setCaption(mix.caption)
        await p.play(mix)
        if (live) setReady(true)
      })
      .catch(() => {})
    return () => {
      live = false
      p.close()
      if (player.current === p) player.current = null
    }
  }, [place])

  const toggle = useCallback(() => {
    // The tap itself unlocks audio if nothing has yet.
    void audioContext().resume().catch(() => {})
    setOn((was) => {
      const next = !was
      player.current?.setOn(next)
      try {
        if (next) localStorage.removeItem(SOUND_OFF)
        else localStorage.setItem(SOUND_OFF, '1')
      } catch {}
      return next
    })
  }, [])

  const status: Soundscape['status'] = !on ? 'off' : !ready ? 'loading' : !unlocked ? 'waiting' : 'on'
  return { status, caption, toggle }
}
