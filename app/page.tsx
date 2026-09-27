'use client'

import { useCallback, useRef, useState } from 'react'
import { Splash } from '@/src/components/Splash'
import { PlacePicker } from '@/src/components/PlacePicker'
import { Explore } from '@/src/components/Explore'
import { Capture } from '@/src/components/Capture'
import { ScanReview, type Background, type ScanLocation, type ScanResult } from '@/src/components/ScanReview'
import { places, type Place } from '@/src/data/places'
import { timesSquareDemo } from '@/src/data/timesSquareDemo'
import { getPosition } from '@/src/lib/geo'
import { requestMotionPermission } from '@/src/lib/motion'
import type { CapturedFrame } from '@/src/lib/stitch'
import type { ScanWithUrl } from '@/app/api/scans/route'

type AppMode = 'splash' | 'capture' | 'review' | 'pick' | 'explore'

// How far "nearby" reaches when browsing while a scan develops.
const NEARBY_M = 1000

function placeFromScan(scan: ScanResult, location: ScanLocation | null): Place {
  return {
    id: `scan-${scan.savedId ?? Date.now()}`,
    name: 'your block',
    neighborhood: scan.generated ? 'reimagined from your scan' : 'raw scan',
    lat: location?.lat ?? 0,
    lng: location?.lng ?? 0,
    year: scan.year,
    panorama: scan.panoramaUrl,
    startYaw: scan.startYaw,
    tidbits: scan.tidbits,
    vaov: scan.vaov,
    vOffset: scan.vOffset,
    viewHfov: scan.viewHfov,
    note: scan.note,
    present: scan.presentUrl,
  }
}

function placeFromSaved(scan: ScanWithUrl): Place {
  return {
    id: `scan-${scan.id}`,
    name: 'saved scan',
    neighborhood: `scanned ${new Date(scan.createdAt).toLocaleDateString()}`,
    lat: scan.lat,
    lng: scan.lng,
    year: scan.year,
    panorama: scan.imageUrl,
    startYaw: scan.startYaw,
    tidbits: scan.tidbits,
    note: scan.note,
    present: scan.presentUrl,
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
  const [background, setBackground] = useState<Background | null>(null)
  // True while the user browses nearby scans during a generation; the result
  // then waits for them instead of pulling them away.
  const browsingRef = useRef(false)

  async function startScan() {
    // Must run inside the tap for iOS to show the motion permission prompt.
    setMotionOk(await requestMotionPermission())
    setLocation(null)
    setNearbyScans([])
    setBackground(null)
    browsingRef.current = false
    setMode('capture')
    // Location is looked up while the user scans; it's optional. Nearby saved
    // scans are fetched with it, to browse while a new scan develops.
    getPosition()
      .then(async ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }
        setLocation(here)
        const res = await fetch(`/api/scans?lat=${here.lat}&lng=${here.lng}&radius=${NEARBY_M}`)
        if (res.ok) setNearbyScans(((await res.json()) as { scans: ScanWithUrl[] }).scans)
      })
      .catch(() => {})
  }

  // Asked again before generating if the first lookup failed: tidbits need a
  // location, so a scan can't be generated without one.
  async function locate(): Promise<ScanLocation | null> {
    try {
      const { coords } = await getPosition(8000, true)
      const here = { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }
      setLocation(here)
      return here
    } catch {
      return null
    }
  }

  const finishCapture = useCallback((captured: CapturedFrame[]) => {
    setFrames(captured)
    setMode('review')
  }, [])

  // Call from a tap: iOS only shows the motion prompt inside one.
  async function askForMotion() {
    if (await requestMotionPermission()) setMotionOk(true)
  }

  function openPlace(next: Place) {
    setPlace(next)
    setMode('explore')
  }

  if (mode === 'capture') {
    return (
      <Capture
        onDone={finishCapture}
        onCancel={() => setMode('splash')}
        here={location}
        onPickScan={(scan) => openPlace(placeFromSaved(scan))}
      />
    )
  }

  if (mode === 'review') {
    return (
      <ScanReview
        frames={frames}
        location={location}
        onLocate={locate}
        onResult={(scan) => {
          if (browsingRef.current) setBackground({ status: 'ready', year: scan.year, result: scan })
          else openPlace(placeFromScan(scan, location))
        }}
        onFailure={(message) => {
          if (browsingRef.current) setBackground((b) => ({ status: 'failed', year: b?.year ?? 0, message }))
        }}
        nearby={nearbyScans}
        onBrowseNearby={(scan, year) => {
          browsingRef.current = true
          setBackground({ status: 'developing', year })
          openPlace(placeFromSaved(scan))
        }}
        onRetake={() => setMode('capture')}
        autoMotion={motionOk}
      />
    )
  }

  if (mode === 'pick') {
    return (
      <PlacePicker
        places={places}
        onPick={async (next) => {
          await askForMotion()
          openPlace(next)
        }}
        onPickScan={(scan) => openPlace(placeFromSaved(scan))}
        onBack={() => setMode('splash')}
      />
    )
  }

  if (mode === 'explore' && place) {
    const fromScan = place.id.startsWith('scan-')
    return (
      <Explore
        // Keyed so hopping to another scan starts with fresh view state.
        key={place.id}
        place={place}
        onBack={() => setMode(fromScan || place.id === timesSquareDemo.id ? 'splash' : 'pick')}
        onPickScan={(scan) => openPlace(placeFromSaved(scan))}
        autoMotion={motionOk}
        background={background}
        onOpenBackground={() => {
          if (background?.status !== 'ready') return
          browsingRef.current = false
          setBackground(null)
          openPlace(placeFromScan(background.result, location))
        }}
        onDismissBackground={() => {
          browsingRef.current = false
          setBackground(null)
        }}
      />
    )
  }

  return <Splash onScan={startScan} onDemo={async () => {
        await askForMotion()
        openPlace(timesSquareDemo)
      }} />
}
