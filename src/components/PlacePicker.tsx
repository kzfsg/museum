'use client'

import { useEffect, useState } from 'react'
import type { Place } from '@/src/data/places'
import type { ScanWithUrl } from '@/app/api/scans/route'

interface PlacePickerProps {
  places: Place[]
  notice?: string
  onPick: (place: Place) => void
  onPickScan: (scan: ScanWithUrl) => void
  onBack: () => void
}

export function PlacePicker({ places, notice, onPick, onPickScan, onBack }: PlacePickerProps) {
  const [scans, setScans] = useState<ScanWithUrl[] | null>(null)

  useEffect(() => {
    fetch('/api/scans')
      .then((res) => (res.ok ? res.json() : { scans: [] }))
      .then((data: { scans: ScanWithUrl[] }) => setScans(data.scans))
      .catch(() => setScans([]))
  }, [])

  return (
    <main className="min-h-dvh px-6 py-8 max-w-md mx-auto">
      <button onClick={onBack} className="text-sm text-muted mb-6">← Back</button>
      <h2 className="font-display text-2xl mb-2">Pick a spot</h2>
      {notice && <p className="text-sm text-muted mb-4">{notice}</p>}

      <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted mt-6 mb-2">Saved scans</h3>
      {scans === null && <p className="text-sm text-muted">Loading…</p>}
      {scans?.length === 0 && <p className="text-sm text-muted">No saved scans yet.</p>}
      <ul className="space-y-2">
        {scans?.map((scan) => (
          <li key={scan.id}>
            <button
              onClick={() => onPickScan(scan)}
              className="w-full text-left rounded-md border border-border bg-surface px-4 py-3"
            >
              <div className="font-medium">
                {scan.lat.toFixed(4)}, {scan.lng.toFixed(4)}
              </div>
              <div className="text-sm text-muted">
                {scan.year} · {scan.tidbits.length} tidbits · {new Date(scan.createdAt).toLocaleString()}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted mt-6 mb-2">Sample spots</h3>
      <ul className="space-y-2">
        {places.map((place) => (
          <li key={place.id}>
            <button
              onClick={() => onPick(place)}
              className="w-full text-left rounded-md border border-border bg-surface px-4 py-3"
            >
              <div className="font-medium">{place.name}</div>
              <div className="text-sm text-muted">
                {place.neighborhood} · {place.year}
                {place.placeholder && ' · placeholder panorama'}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
