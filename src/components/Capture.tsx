'use client'

import { useEffect, useRef, useState } from 'react'
import { angleDiff, watchHeading } from '@/src/lib/motion'
import type { CapturedFrame } from '@/src/lib/stitch'

const SLOT_COUNT = 12
const SLOT_STEP = 360 / SLOT_COUNT
// How close to a slot's heading the phone must be for it to auto-capture.
const CAPTURE_TOLERANCE_DEG = 6
const FRAME_WIDTH = 640

interface CaptureProps {
  onDone: (frames: CapturedFrame[]) => void
  onCancel: () => void
}

export function Capture({ onDone, onCancel }: CaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const framesRef = useRef<Map<number, CapturedFrame>>(new Map())
  const [filled, setFilled] = useState<Set<number>>(new Set())
  const [heading, setHeading] = useState<number | null>(null)
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

  function grabFrame(slot: number, frameHeading: number) {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || framesRef.current.has(slot)) return
    const canvas = document.createElement('canvas')
    canvas.width = FRAME_WIDTH
    canvas.height = Math.round((FRAME_WIDTH * video.videoHeight) / video.videoWidth)
    canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
    framesRef.current.set(slot, { heading: frameHeading, image: canvas })
    setFilled(new Set(framesRef.current.keys()))
  }

  useEffect(() => {
    return watchHeading((deg) => {
      setHeading(deg)
      const slot = Math.round(deg / SLOT_STEP) % SLOT_COUNT
      if (Math.abs(angleDiff(deg, slot * SLOT_STEP)) <= CAPTURE_TOLERANCE_DEG) grabFrame(slot, deg)
    })
  }, [])

  // Without a compass (laptops), each tap captures the next slot in order.
  function manualCapture() {
    const slot = [...Array(SLOT_COUNT).keys()].find((s) => !framesRef.current.has(s))
    if (slot !== undefined) grabFrame(slot, slot * SLOT_STEP)
  }

  const count = filled.size
  const complete = count === SLOT_COUNT

  useEffect(() => {
    if (complete) onDone([...framesRef.current.values()])
  }, [complete, onDone])

  return (
    <main className="fixed inset-0 bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      <header className="absolute top-0 inset-x-0 z-10 flex items-start justify-between p-4 hud-backdrop">
        <button onClick={onCancel} className="text-sm text-muted">Cancel</button>
        <div className="text-right text-sm">
          <div>{count} / {SLOT_COUNT}</div>
          <div className="text-xs text-muted">
            {heading === null ? 'No compass — tap to capture' : `Facing ${Math.round(heading)}°`}
          </div>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-4 p-6">
        {cameraError && <p className="text-sm text-muted text-center">{cameraError}</p>}
        <p className="text-sm text-center">Hold your phone upright and turn slowly in a full circle.</p>
        <HeadingRing filled={filled} heading={heading} />
        <div className="flex gap-2">
          {heading === null && (
            <button onClick={manualCapture} className="rounded-md bg-primary px-4 py-2 text-sm">
              Capture
            </button>
          )}
          <button
            onClick={() => onDone([...framesRef.current.values()])}
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

function HeadingRing({ filled, heading }: { filled: Set<number>; heading: number | null }) {
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
          className="stroke-white"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
