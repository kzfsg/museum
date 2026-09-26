'use client'

import { useCallback, useState } from 'react'
import { Splash } from '@/src/components/Splash'
import { PlacePicker } from '@/src/components/PlacePicker'
import { Explore } from '@/src/components/Explore'
import { Capture } from '@/src/components/Capture'
import { ScanReview, type ScanResult } from '@/src/components/ScanReview'
import { places, type Place } from '@/src/data/places'
import { requestMotionPermission } from '@/src/lib/motion'
import type { CapturedFrame } from '@/src/lib/stitch'

type AppMode = 'splash' | 'capture' | 'review' | 'pick' | 'explore'

function placeFromScan(scan: ScanResult): Place {
  return {
    id: `scan-${Date.now()}`,
    name: 'Your block',
    neighborhood: scan.generated ? 'Reimagined from your scan' : 'Raw scan',
    lat: 0,
    lng: 0,
    year: scan.year,
    panorama: scan.panoramaUrl,
    startYaw: scan.startYaw,
    tidbits: [],
  }
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>('splash')
  const [place, setPlace] = useState<Place | null>(null)
  const [frames, setFrames] = useState<CapturedFrame[]>([])

  async function startScan() {
    // Must run inside the tap for iOS to show the motion permission prompt.
    await requestMotionPermission()
    setMode('capture')
  }

  const finishCapture = useCallback((captured: CapturedFrame[]) => {
    setFrames(captured)
    setMode('review')
  }, [])

  function openPlace(next: Place) {
    setPlace(next)
    setMode('explore')
  }

  if (mode === 'capture') {
    return <Capture onDone={finishCapture} onCancel={() => setMode('splash')} />
  }

  if (mode === 'review') {
    return (
      <ScanReview
        frames={frames}
        onResult={(scan) => openPlace(placeFromScan(scan))}
        onRetake={() => setMode('capture')}
      />
    )
  }

  if (mode === 'pick') {
    return <PlacePicker places={places} onPick={openPlace} onBack={() => setMode('splash')} />
  }

  if (mode === 'explore' && place) {
    const fromScan = place.id.startsWith('scan-')
    return <Explore place={place} onBack={() => setMode(fromScan ? 'splash' : 'pick')} />
  }

  return <Splash onScan={startScan} onBrowse={() => setMode('pick')} />
}
