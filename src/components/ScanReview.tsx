'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { canvasToBlob, stitchEquirect, type CapturedFrame } from '@/src/lib/stitch'
import type { Tidbit } from '@/src/data/places'
import type { GenerateResponse } from '@/app/api/generate/route'

const PanoramaViewer = dynamic(
  () => import('@/src/components/PanoramaViewer').then((mod) => mod.PanoramaViewer),
  { ssr: false }
)

const YEARS = [1900, 1920, 1940, 1970]
// The image model only accepts 3:2, so the 2:1 panorama is squashed for the
// request. The viewer is told the image spans 360x180 degrees, which stretches
// it back, so the result is used as-is.
const MODEL_SIZE = { width: 1536, height: 1024 }
const PANO_SIZE = { width: 2048, height: 1024 }

export interface ScanResult {
  panoramaUrl: string
  year: number
  generated: boolean
  startYaw: number
  tidbits: Tidbit[]
}

export interface ScanLocation {
  lat: number
  lng: number
}

interface ScanReviewProps {
  frames: CapturedFrame[]
  // Null when location was denied or unavailable; the scan then isn't saved.
  location: ScanLocation | null
  onResult: (result: ScanResult) => void
  onRetake: () => void
}

export function ScanReview({ frames, location, onResult, onRetake }: ScanReviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [year, setYear] = useState(1920)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startYaw = frames[0]?.heading ?? 0

  useEffect(() => {
    let url: string | null = null
    canvasToBlob(stitchEquirect(frames, PANO_SIZE.width, PANO_SIZE.height)).then((blob) => {
      url = URL.createObjectURL(blob)
      setPreviewUrl(url)
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [frames])

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const squashed = await canvasToBlob(stitchEquirect(frames, MODEL_SIZE.width, MODEL_SIZE.height))
      const form = new FormData()
      form.set('image', squashed, 'scan.jpg')
      form.set('year', String(year))
      form.set('startYaw', String(startYaw))
      if (location) {
        form.set('lat', String(location.lat))
        form.set('lng', String(location.lng))
      }
      const res = await fetch('/api/generate', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
        throw new Error(error)
      }
      const data = (await res.json()) as GenerateResponse
      onResult({ panoramaUrl: data.imageUrl, year, generated: true, startYaw, tidbits: data.tidbits })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setBusy(false)
    }
  }

  // A fresh URL, because the preview URL is revoked when this screen unmounts.
  async function viewRaw() {
    const blob = await canvasToBlob(stitchEquirect(frames, PANO_SIZE.width, PANO_SIZE.height))
    onResult({ panoramaUrl: URL.createObjectURL(blob), year: new Date().getFullYear(), generated: false, startYaw, tidbits: [] })
  }

  return (
    <main className="fixed inset-0">
      {previewUrl && <PanoramaViewer src={previewUrl} yaw={startYaw} />}

      <header className="absolute top-0 inset-x-0 z-20 flex items-start justify-between p-4 hud-backdrop">
        <button onClick={onRetake} disabled={busy} className="text-sm text-muted">← Retake</button>
        <div className="text-right text-xs text-muted">
          <div>Your scan · {frames.length} photos</div>
          <div>{location ? 'Location found · will be saved' : 'No location · history and saving off'}</div>
        </div>
      </header>

      <footer className="absolute bottom-0 inset-x-0 z-20 space-y-3 p-4">
        {error && (
          <div className="rounded-md bg-surface/90 p-3 text-sm space-y-2">
            <p>{error}</p>
            {previewUrl && (
              <button onClick={viewRaw} className="text-muted underline">
                View the raw scan instead
              </button>
            )}
          </div>
        )}
        {busy ? (
          <p className="text-center text-[10px] tracking-[0.15em] uppercase text-muted">
            Developing {year}… this can take a minute
          </p>
        ) : (
          <>
            <div className="flex justify-center gap-2">
              {YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${y === year ? 'border-primary bg-primary/30' : 'border-border bg-surface/80'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button onClick={generate} className="w-full rounded-md bg-primary px-4 py-3 font-medium">
              See it in {year}
            </button>
          </>
        )}
      </footer>
    </main>
  )
}
