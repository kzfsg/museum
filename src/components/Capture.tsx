'use client'

import { useEffect, useRef, useState } from 'react'
import { angleDiff, circularMean, normalizeDeg, watchOrientation, type Orientation } from '@/src/lib/motion'
import { CAMERA_WARMUP_MS, canCapture, guide, isUsableFrame, SCAN_SLOTS } from '@/src/lib/captureGuide'
import type { CapturedFrame } from '@/src/lib/stitch'

const SLOT_COUNT = SCAN_SLOTS
const SLOT_STEP = 360 / SLOT_COUNT
// How close to a slot's heading the phone must be for it to auto-capture.
const CAPTURE_TOLERANCE_DEG = 6
const FRAME_WIDTH = 640

interface CaptureProps {
  onDone: (frames: CapturedFrame[]) => void
  onCancel: () => void
  // Saved scans within a few metres of here; lets the user skip scanning.
  nearbyCount?: number
  onOpenNearby?: () => void
}

export function Capture({ onDone, onCancel, nearbyCount = 0, onOpenNearby }: CaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // When the camera started delivering frames (null until then).
  const cameraReadyAtRef = useRef<number | null>(null)
  // Frames are placed by gyro-only heading so they stay consistent with each
  // other; the compass's view of north is collected separately and applied as
  // one rotation at the end (see `finish`).
  const framesRef = useRef<Map<number, CapturedFrame>>(new Map())
  const northOffsetsRef = useRef<number[]>([])
  const [filled, setFilled] = useState<Set<number>>(new Set())
  const [reading, setReading] = useState<Orientation | null>(null)
  // Total rotation so far, to notice a full lap that left gaps.
  const turnedRef = useRef({ total: 0, last: null as number | null })
  const heading = reading?.heading ?? null
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setCameraError('Camera access was denied or is unavailable.'))
    if (!navigator.mediaDevices) setCameraError('Camera needs a secure (https) page.')
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function grabFrame(slot: number, frameHeading: number, framePitch: number) {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || framesRef.current.has(slot)) return
    const readyAt = cameraReadyAtRef.current
    if (readyAt === null || performance.now() - readyAt < CAMERA_WARMUP_MS) return
    const canvas = document.createElement('canvas')
    canvas.width = FRAME_WIDTH
    canvas.height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    // Leave the slot open if the camera handed us a black frame.
    const probe = document.createElement('canvas')
    probe.width = 16
    probe.height = 16
    const probeCtx = probe.getContext('2d', { willReadFrequently: true })!
    probeCtx.drawImage(canvas, 0, 0, 16, 16)
    if (!isUsableFrame(probeCtx.getImageData(0, 0, 16, 16).data)) return
    framesRef.current.set(slot, { heading: frameHeading, pitch: framePitch, image: canvas })
    setFilled(new Set(framesRef.current.keys()))
  }

  useEffect(() => {
    return watchOrientation((o) => {
      setReading(o)
      const turned = turnedRef.current
      if (turned.last !== null) turned.total += Math.abs(angleDiff(o.rawHeading, turned.last))
      turned.last = o.rawHeading
      if (o.absolute) northOffsetsRef.current.push(normalizeDeg(o.heading - o.rawHeading))
      if (!canCapture(o)) return
      const slot = Math.round(o.rawHeading / SLOT_STEP) % SLOT_COUNT
      if (Math.abs(angleDiff(o.rawHeading, slot * SLOT_STEP)) <= CAPTURE_TOLERANCE_DEG) grabFrame(slot, o.rawHeading, o.pitch)
    })
  }, [])

  // Without a compass (laptops), each tap captures the next slot in order.
  function manualCapture() {
    const slot = [...Array(SLOT_COUNT).keys()].find((s) => !framesRef.current.has(s))
    if (slot !== undefined) grabFrame(slot, slot * SLOT_STEP, 0)
  }

  const count = filled.size
  const complete = count === SLOT_COUNT
  const guidance = guide({
    hasSensor: reading !== null,
    speed: reading?.speed ?? 0,
    pitch: reading?.pitch ?? 0,
    filled: count,
    total: SLOT_COUNT,
    turnedDeg: turnedRef.current.total,
  })
  const warning = guidance.status === 'too-fast' || guidance.status === 'tilted'

  // Rotates the gyro-placed frames so heading 0 is north.
  function finish() {
    const offset = circularMean(northOffsetsRef.current) ?? 0
    onDone([...framesRef.current.values()].map((f) => ({ ...f, heading: normalizeDeg(f.heading + offset) })))
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    if (complete) finishRef.current()
  }, [complete])

  return (
    <main className="fixed inset-0 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onPlaying={() => {
          cameraReadyAtRef.current ??= performance.now()
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      <header className="absolute top-0 inset-x-0 z-10 flex items-start justify-between p-4 hud-backdrop">
        <button onClick={onCancel} className="text-sm text-muted">Cancel</button>
        <div className="text-right text-sm">
          <div>{count} / {SLOT_COUNT}</div>
          <div className="text-xs text-muted">
            {heading === null ? 'No motion sensor' : `Facing ${Math.round(heading)}°${reading?.absolute ? '' : ' (no compass)'}`}
          </div>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 p-6">
        {nearbyCount > 0 && onOpenNearby && (
          <button onClick={onOpenNearby} className="rounded-md bg-surface/90 px-4 py-2 text-sm">
            This spot has already been scanned · <span className="underline">View it now</span>
          </button>
        )}
        {cameraError && <p className="text-sm text-muted text-center">{cameraError}</p>}
        <p
          className={`rounded-md px-3 py-1.5 text-sm text-center transition-colors ${warning ? 'bg-red-700/90 font-medium' : 'bg-black/40'}`}
          aria-live="polite"
        >
          {guidance.message}
        </p>
        <HeadingRing filled={filled} heading={reading?.rawHeading ?? null} warning={warning} />
        <div className="flex gap-2">
          {heading === null && (
            <button onClick={manualCapture} className="rounded-md bg-primary px-4 py-2 text-sm">
              Capture
            </button>
          )}
          <button
            onClick={finish}
            disabled={count === 0}
            className="rounded-md border border-border bg-surface/80 px-4 py-2 text-sm disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </div>
    </main>
  )
}

function HeadingRing({ filled, heading, warning }: { filled: Set<number>; heading: number | null; warning: boolean }) {
  const r = 40
  return (
    <svg viewBox="-50 -50 100 100" className="h-28 w-28">
      {[...Array(SLOT_COUNT).keys()].map((slot) => {
        const a = ((slot * SLOT_STEP - 90) * Math.PI) / 180
        return (
          <circle
            key={slot}
            cx={r * Math.cos(a)}
            cy={r * Math.sin(a)}
            r={5}
            className={filled.has(slot) ? 'fill-primary' : 'fill-white/25'}
          />
        )
      })}
      {heading !== null && (
        <line
          x1={0}
          y1={0}
          x2={30 * Math.cos(((heading - 90) * Math.PI) / 180)}
          y2={30 * Math.sin(((heading - 90) * Math.PI) / 180)}
          className={warning ? 'stroke-red-500' : 'stroke-white'}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
