'use client'

import { useEffect, useRef, useState } from 'react'
import { Compass, Images, Map as MapIcon, X } from 'lucide-react'
import { SamplesSheet } from './SamplesSheet'
import type { Place } from '@/src/data/places'
import { TimeMachineIcon } from './TimeMachineIcon'
import styles from './chrome.module.css'
import { angleDiff, circularMean, normalizeDeg, requestMotionPermission, watchOrientation, type Orientation } from '@/src/lib/motion'
import { CAMERA_WARMUP_MS, canCapture, guide, isUsableFrame, SCAN_SLOTS } from '@/src/lib/captureGuide'
import type { CapturedFrame } from '@/src/lib/stitch'
import { MapScreen } from '@/src/components/MapScreen'
import type { ScanWithUrl } from '@/app/api/scans/route'

const SLOT_COUNT = SCAN_SLOTS
const SLOT_STEP = 360 / SLOT_COUNT
// How close to a slot's heading the phone must be for it to auto-capture.
const CAPTURE_TOLERANCE_DEG = 6
const FRAME_WIDTH = 640
// With no orientation reading by now, motion is blocked or missing.
const SENSOR_WAIT_MS = 1500

interface CaptureProps {
  onDone: (frames: CapturedFrame[]) => void
  onCancel: () => void
  // The user's position once known, to center the map.
  here?: { lat: number; lng: number } | null
  // Open a saved scan picked on the map.
  onPickScan: (scan: ScanWithUrl) => void
  onPickSample: (place: Place) => void
}

export function Capture({ onDone, onCancel, here, onPickScan, onPickSample }: CaptureProps) {
  // The map opens over the camera so the scan so far survives a look around.
  const [mapOpen, setMapOpen] = useState(false)
  const [samplesOpen, setSamplesOpen] = useState(false)
  // Auto-capture is paused while the map covers the camera.
  const pausedRef = useRef(false)
  pausedRef.current = mapOpen || samplesOpen
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
  const readingRef = useRef<Orientation | null>(null)
  readingRef.current = reading
  // Total rotation so far, to notice a full lap that left gaps.
  const turnedRef = useRef({ total: 0, last: null as number | null })
  const heading = reading?.heading ?? null
  const [cameraError, setCameraError] = useState<string | null>(null)
  // No reading arrived in time: offer to turn motion on (iOS may have skipped
  // or refused the prompt at the start), since photos are only taken by turning.
  const [sensorLate, setSensorLate] = useState(false)
  const [motionError, setMotionError] = useState<string | null>(null)

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
      .catch(() => setCameraError('camera access was denied or is unavailable. allow it in your browser settings and try again.'))
    if (!navigator.mediaDevices) setCameraError('the camera needs a secure (https) page.')
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
      if (pausedRef.current || !canCapture(o)) return
      const slot = Math.round(o.rawHeading / SLOT_STEP) % SLOT_COUNT
      if (Math.abs(angleDiff(o.rawHeading, slot * SLOT_STEP)) <= CAPTURE_TOLERANCE_DEG) grabFrame(slot, o.rawHeading, o.pitch)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setSensorLate(true), SENSOR_WAIT_MS)
    return () => clearTimeout(timer)
  }, [])

  // Must run inside the tap for iOS to show the prompt again.
  async function enableMotion() {
    setMotionError(null)
    if (!(await requestMotionPermission())) {
      setMotionError('motion access is blocked. quit and reopen your browser, then allow motion when asked.')
      return
    }
    // Granted, but still silent after a moment: there's no sensor to read.
    setTimeout(() => {
      if (!readingRef.current) setMotionError('no motion sensor found. scan with a phone to capture as you turn.')
    }, SENSOR_WAIT_MS)
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
    if (framesRef.current.size !== SLOT_COUNT) return
    const offset = circularMean(northOffsetsRef.current) ?? 0
    onDone([...framesRef.current.values()].map((f) => ({ ...f, heading: normalizeDeg(f.heading + offset) })))
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    if (complete) finishRef.current()
  }, [complete])

  return (
    <main className={styles.screen}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onPlaying={() => {
          cameraReadyAtRef.current ??= performance.now()
        }}
        className={styles.camera}
      />

      <header className={styles.top}>
        <button onClick={onCancel} className={styles.bare} aria-label="cancel scan">
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className={styles.wordmark}>
          time machine
          <TimeMachineIcon size={16} strokeWidth={1.75} />
        </span>
        <div className={styles.meta}>
          <span className={styles.metaMain}>
            {count} / {SLOT_COUNT}
          </span>
          <span className={styles.metaSub}>
            {heading === null ? 'motion off' : `facing ${Math.round(heading)}°${reading?.absolute ? '' : ' · no compass'}`}
          </span>
        </div>
      </header>

      <div className={styles.bottom}>
        {cameraError && <p className={styles.hint}>{cameraError}</p>}
        {motionError && <p className={styles.hint}>{motionError}</p>}
        <p className={warning ? `${styles.pill} ${styles.wrap} ${styles.guide} ${styles.guideWarn}` : styles.guideText} aria-live="polite">
          {guidance.message}
        </p>
        <HeadingRing filled={filled} heading={reading?.rawHeading ?? null} />
        <div className={styles.row}>
          <button onClick={() => setMapOpen(true)} className={styles.pill}>
            map
            <MapIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {heading === null && sensorLate && (
            <button onClick={enableMotion} className={`${styles.pill} ${styles.ink} ${styles.primary}`}>
              turn on motion
              <Compass size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <button onClick={() => setSamplesOpen(true)} className={styles.pill}>
            samples
            <Images size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>

      {mapOpen && <MapScreen here={here} onPick={onPickScan} onBack={() => setMapOpen(false)} />}
      <SamplesSheet open={samplesOpen} onOpenChange={setSamplesOpen} onPick={onPickSample} />
    </main>
  )
}

function HeadingRing({ filled, heading }: { filled: Set<number>; heading: number | null }) {
  const r = 38
  return (
    <svg viewBox="-50 -50 100 100" className={styles.ring} role="img" aria-label={`${filled.size} of ${SLOT_COUNT} photos captured`}>
      {[...Array(SLOT_COUNT).keys()].map((slot) => {
        const a = ((slot * SLOT_STEP - 90) * Math.PI) / 180
        return (
          <circle
            key={slot}
            cx={r * Math.cos(a)}
            cy={r * Math.sin(a)}
            r={5.5}
            className={`${styles.ringDot} ${filled.has(slot) ? styles.ringDotOn : ''}`}
          />
        )
      })}
      {heading !== null && (
        <line
          x1={0}
          y1={0}
          x2={24 * Math.cos(((heading - 90) * Math.PI) / 180)}
          y2={24 * Math.sin(((heading - 90) * Math.PI) / 180)}
          className={styles.ringHand}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}
