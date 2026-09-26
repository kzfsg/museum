'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, CircleAlert } from 'lucide-react'
import styles from './chrome.module.css'
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

// The server accepts 1600-2000 (see app/api/generate/route.ts).
const MIN_YEAR = 1600
const MAX_YEAR = 2000
const DEFAULT_YEAR = 1920
const CENTURIES = [1600, 1700, 1800, 1900, 2000]
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
  const [year, setYear] = useState(DEFAULT_YEAR)
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
        const { error } = await res.json().catch(() => ({ error: `the request failed (${res.status}). try again in a moment.` }))
        throw new Error(error)
      }
      const data = (await res.json()) as GenerateResponse
      onResult({ panoramaUrl: data.imageUrl, year, generated: true, startYaw, tidbits: data.tidbits, viewHfov, note: data.note })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'generation failed. check your connection and try again.')
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
    <main className={styles.screen}>
      {preview && <PanoramaViewer src={preview.url} vaov={preview.vaov} vOffset={preview.vOffset} hfov={viewHfov} yaw={startYaw} motion={autoMotion} />}

      <header className={styles.top}>
        <button onClick={onRetake} disabled={busy} className={styles.bare}>
          <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" />
          retake
        </button>
        <div className={styles.meta}>
          <span className={styles.metaMain}>
            {frames.length} photos · lens {Math.round(lens.hfov)}°{lens.measured ? '' : ' (est.)'}
          </span>
          <span className={styles.metaSub}>{location ? 'location found, will be saved' : 'no location, history and saving off'}</span>
        </div>
      </header>

      <div className={styles.bottom}>
        <section className={styles.sheet} aria-live="polite">
          {error && (
            <div className={styles.notice} role="alert">
              <CircleAlert size={18} strokeWidth={1.75} className={styles.noticeIcon} aria-hidden="true" />
              <p>
                {error}{' '}
                {preview && (
                  <button onClick={viewRaw} className={styles.linkButton}>
                    view the raw scan instead
                  </button>
                )}
              </p>
            </div>
          )}
          {missing > 0 && !busy && (
            <div className={styles.notice}>
              <CircleAlert size={18} strokeWidth={1.75} className={styles.noticeIcon} aria-hidden="true" />
              <p>
                {missing} of {SCAN_SLOTS} photos missing, so the ai will have to invent those parts.
              </p>
              <button onClick={onRetake} className={styles.pill}>
                retake
              </button>
            </div>
          )}
          {busy ? (
            <div className={styles.developing}>
              <p>developing {year}…</p>
              <small>this can take a minute</small>
              <div className={styles.progress} aria-hidden="true" />
            </div>
          ) : (
            <>
              <div className={styles.scrub}>
                <output htmlFor="year-scrub" className={styles.scrubYear}>
                  {year}
                </output>
                <div className={styles.scrubTrack}>
                  <input
                    id="year-scrub"
                    type="range"
                    min={MIN_YEAR}
                    max={MAX_YEAR}
                    step={1}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    aria-label="year"
                    aria-valuetext={String(year)}
                    className={styles.scrubInput}
                  />
                  <div className={styles.scrubLabels} aria-hidden="true">
                    {CENTURIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        tabIndex={-1}
                        onClick={() => setYear(c)}
                        style={{ left: `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${(c - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)})` }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.sheetBlock}>
                <button onClick={generate} className={`${styles.pill} ${styles.ink} ${styles.primary}`}>
                  see it in {year}
                  <ArrowUpRight size={19} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
