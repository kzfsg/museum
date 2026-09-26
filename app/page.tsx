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
    vaov: scan.vaov,
    vOffset: scan.vOffset,
    viewHfov: scan.viewHfov,
    note: scan.note,
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
    note: scan.note,
  }
}

export default function Home() {
  const [mode, setMode] = useState<AppMode>('splash')
  const [place, setPlace] = useState<Place | null>(null)
  const [frames, setFrames] = useState<CapturedFrame[]>([])
  const [location, setLocation] = useState<ScanLocation | null>(null)
  const [nearbyScans, setNearbyScans] = useState<ScanWithUrl[]>([])
  // Whether device motion may be used without another tap (iOS asks once per page).
  const [motionOk, setMotionOk] = useState(false)

  async function startScan() {
    // Must run inside the tap for iOS to show the motion permission prompt.
    setMotionOk(await requestMotionPermission())
    setLocation(null)
    setNearbyScans([])
    setMode('capture')
    // Location is looked up while the user scans; it's optional.
    getPosition()
      .then(async ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }
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
        autoMotion={motionOk}
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
    return <Explore place={place} onBack={() => setMode(fromScan ? 'splash' : 'pick')} autoMotion={motionOk} />
  }

  return <Splash onScan={startScan} />
}
