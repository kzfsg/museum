'use client'

import { useCallback, useState } from 'react'
import { Splash } from '@/src/components/Splash'
import { PlacePicker } from '@/src/components/PlacePicker'
import { Explore } from '@/src/components/Explore'
import { Capture } from '@/src/components/Capture'
import { ScanReview, type ScanLocation, type ScanResult } from '@/src/components/ScanReview'
import { places, type Place } from '@/src/data/places'
import { getPosition } from '@/src/lib/geo'
import { requestMotionPermission } from '@/src/lib/motion'
import type { CapturedFrame } from '@/src/lib/stitch'
import type { ScanWithUrl } from '@/app/api/scans/route'

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
    tidbits: scan.tidbits,
  }
}

function placeFromSaved(scan: ScanWithUrl): Place {
  return {
    id: `scan-${scan.id}`,
    name: 'Saved scan',
    neighborhood: `Scanned ${new Date(scan.createdAt).toLocaleDateString()}`,
    lat: scan.lat,
    lng: scan.lng,
    year: scan.year,
    panorama: scan.imageUrl,
    startYaw: scan.startYaw,
    tidbits: scan.tidbits,
  }
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>('splash')
  const [place, setPlace] = useState<Place | null>(null)
  const [frames, setFrames] = useState<CapturedFrame[]>([])
  const [location, setLocation] = useState<ScanLocation | null>(null)
  const [nearbyScans, setNearbyScans] = useState<ScanWithUrl[]>([])

  async function startScan() {
    // Must run inside the tap for iOS to show the motion permission prompt.
    await requestMotionPermission()
    setLocation(null)
    setNearbyScans([])
    setMode('capture')
    // Location is looked up while the user scans; it's optional.
    getPosition()
      .then(async ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude }
        setLocation(here)
        const res = await fetch(`/api/scans?lat=${here.lat}&lng=${here.lng}`)
        if (res.ok) setNearbyScans(((await res.json()) as { scans: ScanWithUrl[] }).scans)
      })
      .catch(() => {})
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
    return (
      <Capture
        onDone={finishCapture}
        onCancel={() => setMode('splash')}
        nearbyCount={nearbyScans.length}
        onOpenNearby={() => openPlace(placeFromSaved(nearbyScans[0]))}
      />
    )
  }

  if (mode === 'review') {
    return (
      <ScanReview
        frames={frames}
        location={location}
        onResult={(scan) => openPlace(placeFromScan(scan))}
        onRetake={() => setMode('capture')}
      />
    )
  }

  if (mode === 'pick') {
    return (
      <PlacePicker
        places={places}
        onPick={openPlace}
        onPickScan={(scan) => openPlace(placeFromSaved(scan))}
        onBack={() => setMode('splash')}
      />
    )
  }

  if (mode === 'explore' && place) {
    const fromScan = place.id.startsWith('scan-')
    return <Explore place={place} onBack={() => setMode(fromScan ? 'splash' : 'pick')} />
  }

  return <Splash onScan={startScan} onBrowse={() => setMode('pick')} />
}
