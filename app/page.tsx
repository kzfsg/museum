'use client'

import { useRef, useState } from 'react'
import { Splash } from '@/src/components/Splash'
import { PlacePicker } from '@/src/components/PlacePicker'
import { Explore } from '@/src/components/Explore'
import { places, type Place } from '@/src/data/places'
import { getPosition, nearestPlace } from '@/src/lib/geo'

// How close you need to be to a spot for "Scan" to open it directly.
const NEARBY_KM = 2

type AppMode = 'splash' | 'locating' | 'pick' | 'explore'

export default function Home() {
  const [mode, setMode] = useState<AppMode>('splash')
  const [place, setPlace] = useState<Place | null>(null)
  const [notice, setNotice] = useState<string | undefined>()
  // Bumped whenever the user leaves the locating screen, so a late result is ignored.
  const scanId = useRef(0)

  function openPlace(next: Place) {
    setPlace(next)
    setMode('explore')
  }

  function browse(message?: string) {
    scanId.current++
    setNotice(message)
    setMode('pick')
  }

  async function scan() {
    setMode('locating')
    const id = ++scanId.current
    try {
      const { coords } = await getPosition()
      if (id !== scanId.current) return
      const nearest = nearestPlace(places, coords.latitude, coords.longitude)
      if (nearest && nearest.km <= NEARBY_KM) openPlace(nearest.place)
      else browse(`No spots within ${NEARBY_KM} km of you yet. Pick one to explore.`)
    } catch {
      if (id !== scanId.current) return
      browse('Couldn’t get your location. Pick a spot to explore.')
    }
  }

  if (mode === 'locating') {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-6">
        <p className="text-[10px] tracking-[0.15em] text-muted uppercase">Finding where you are…</p>
        <button onClick={() => browse()} className="text-sm text-muted underline">
          Pick a spot instead
        </button>
      </main>
    )
  }

  if (mode === 'pick') {
    return <PlacePicker places={places} notice={notice} onPick={openPlace} onBack={() => setMode('splash')} />
  }

  if (mode === 'explore' && place) {
    return <Explore place={place} onBack={() => browse()} />
  }

  return <Splash onScan={scan} onBrowse={() => browse()} />
}
