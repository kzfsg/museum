'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { canvasToBlob, frameVfov, scanHfov, stitchBand, stitchEquirect, type CapturedFrame } from '@/src/lib/stitch'
import { fitHfov } from '@/src/components/PanoramaViewer'
import { SCAN_SLOTS } from '@/src/lib/captureGuide'
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
const PREVIEW_WIDTH = 2048

export interface ScanResult {
  panoramaUrl: string
  year: number
  generated: boolean
  startYaw: number
  tidbits: Tidbit[]
  vaov?: number
  vOffset?: number
  viewHfov?: number
  note?: string | null
}

export interface ScanLocation {
  lat: number
  lng: number
  // GPS accuracy in meters, if reported.
  accuracy?: number
}

interface ScanReviewProps {
  frames: CapturedFrame[]
  // Null when location was denied or unavailable; the scan then isn't saved.
  location: ScanLocation | null
  onResult: (result: ScanResult) => void
  onRetake: () => void
  // Follow the phone's motion from the start (permission already granted).
  autoMotion?: boolean
}

export function ScanReview({ frames, location, onResult, onRetake, autoMotion = false }: ScanReviewProps) {
  const [preview, setPreview] = useState<{ url: string; vaov: number; vOffset: number } | null>(null)
  const [year, setYear] = useState(1920)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startYaw = frames[0]?.heading ?? 0
  const missing = SCAN_SLOTS - frames.length
  // Measured once per scan from how neighbouring photos overlap.
  const lens = useMemo(() => scanHfov(frames), [frames])
  // Show the scan at the same zoom the live camera had: the camera filled the
  // screen's height, so match its vertical FOV.
  const viewHfov = useMemo(() => {
    if (!frames[0] || typeof window === 'undefined') return undefined
    return fitHfov(frameVfov(frames[0].image, lens.hfov), window.innerWidth, window.innerHeight)
  }, [frames, lens])

  useEffect(() => {
    let url: string | null = null
    const { canvas, vaov, vOffset } = stitchBand(frames, lens.hfov, PREVIEW_WIDTH)
    canvasToBlob(canvas).then((blob) => {
      url = URL.createObjectURL(blob)
      setPreview({ url, vaov, vOffset })
    })
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [frames, lens])

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const squashed = await canvasToBlob(stitchEquirect(frames, lens.hfov, MODEL_SIZE.width, MODEL_SIZE.height))
      const form = new FormData()
      form.set('image', squashed, 'scan.jpg')
      form.set('year', String(year))
      form.set('startYaw', String(startYaw))
      form.set(
        'capture',
        JSON.stringify({
          frames: frames.map((f) => ({ heading: Math.round(f.heading * 10) / 10, pitch: Math.round(f.pitch * 10) / 10 })),
          frameSize: frames[0] ? [frames[0].image.width, frames[0].image.height] : undefined,
          lensHfov: Math.round(lens.hfov * 10) / 10,
          lensMeasured: lens.measured,
          userAgent: navigator.userAgent,
        })
      )
      if (location) {
        form.set('lat', String(location.lat))
        form.set('lng', String(location.lng))
        if (location.accuracy) form.set('accuracy', String(location.accuracy))
      }
      const res = await fetch('/api/generate', { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
        throw new Error(error)
      }
      const data = (await res.json()) as GenerateResponse
      onResult({ panoramaUrl: data.imageUrl, year, generated: true, startYaw, tidbits: data.tidbits, viewHfov, note: data.note })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setBusy(false)
    }
  }

  // A fresh URL, because the preview URL is revoked when this screen unmounts.
  async function viewRaw() {
    const { canvas, vaov, vOffset } = stitchBand(frames, lens.hfov, PREVIEW_WIDTH)
    const blob = await canvasToBlob(canvas)
    onResult({ panoramaUrl: URL.createObjectURL(blob), year: new Date().getFullYear(), generated: false, startYaw, tidbits: [], vaov, vOffset, viewHfov })
  }

  return (
    <main className="fixed inset-0">
      {preview && <PanoramaViewer src={preview.url} vaov={preview.vaov} vOffset={preview.vOffset} hfov={viewHfov} yaw={startYaw} motion={autoMotion} />}

      <header className="absolute top-0 inset-x-0 z-20 flex items-start justify-between p-4 hud-backdrop">
        <button onClick={onRetake} disabled={busy} className="text-sm text-muted">← Retake</button>
        <div className="text-right text-xs text-muted">
          <div>
            Your scan · {frames.length} photos · lens {Math.round(lens.hfov)}°{lens.measured ? '' : ' (est.)'}
          </div>
          <div>{location ? 'Location found · will be saved' : 'No location · history and saving off'}</div>
        </div>
      </header>

      <footer className="absolute bottom-0 inset-x-0 z-20 space-y-3 p-4">
        {error && (
          <div className="rounded-md bg-surface/90 p-3 text-sm space-y-2">
            <p>{error}</p>
            {preview && (
              <button onClick={viewRaw} className="text-muted underline">
                View the raw scan instead
              </button>
            )}
          </div>
        )}
        {missing > 0 && !busy && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-red-800/90 p-3 text-sm">
            <p>
              {missing} of {SCAN_SLOTS} photos missing — the AI will have to invent those parts.
            </p>
            <button onClick={onRetake} className="shrink-0 rounded-md bg-foreground px-3 py-1.5 font-medium text-background">
              Retake
            </button>
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
