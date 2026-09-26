'use client'

import { useEffect, useRef, useState } from 'react'
import { angleDiff, toYawRange, watchOrientation } from '@/src/lib/motion'
import { CAMERA_HFOV_DEG } from '@/src/lib/stitch'

interface PannellumViewer {
  destroy: () => void
  on: (event: string, cb: () => void) => void
  getYaw: () => number
  setYaw: (yaw: number, animated?: number | false) => void
  setPitch: (pitch: number, animated?: number | false) => void
}

declare global {
  interface Window {
    pannellum?: {
      viewer: (container: string | HTMLElement, config: Record<string, unknown>) => PannellumViewer
    }
  }
}

// compass: view heading equals real-world heading. relative: follows turns but
// isn't tied to north (no compass). unavailable: no motion sensor at all.
export type MotionMode = 'compass' | 'relative' | 'unavailable'

// Fraction of the remaining angle closed each frame; lower is smoother but laggier.
const SMOOTHING = 0.2
// If no orientation reading arrives in this time, the device has no sensor.
const SENSOR_WAIT_MS = 1500
// On a portrait phone, show roughly what the camera sees so the panorama feels
// like looking through the phone rather than a zoomed-out fishbowl.
const PORTRAIT_HFOV = CAMERA_HFOV_DEG + 8
const LANDSCAPE_HFOV = 100

// Widest horizontal FOV at which a band `vaov` degrees tall still fills the
// screen height, so partial panoramas never show empty space above or below.
export function fitHfov(vaov: number, width: number, height: number): number {
  return (2 * Math.atan(Math.tan((vaov * Math.PI) / 360) * (width / height)) * 180) / Math.PI
}

export interface PanoramaHotspot {
  id: string
  pitch: number
  yaw: number
  label: string
}

interface PanoramaViewerProps {
  src: string
  // Vertical coverage in degrees; less than 180 for a partial (band) panorama.
  vaov?: number
  hotspots?: PanoramaHotspot[]
  onHotspotClick?: (id: string) => void
  // Pan the view by moving the phone. Uses the compass when available so the
  // panorama's yaw matches real-world heading.
  motion?: boolean
  // Manual correction (degrees) added to the heading.
  yawOffset?: number
  onMotionMode?: (mode: MotionMode) => void
  // Initial view direction; for scans this equals the compass heading.
  yaw?: number
  onLoad?: () => void
}

export function PanoramaViewer({
  src,
  vaov = 180,
  hotspots = [],
  onHotspotClick,
  motion = false,
  yawOffset = 0,
  onMotionMode,
  yaw = 0,
  onLoad,
}: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PannellumViewer | null>(null)
  const [loaded, setLoaded] = useState(false)
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const onHotspotClickRef = useRef(onHotspotClick)
  onHotspotClickRef.current = onHotspotClick
  // Hotspots, yaw, and vaov are read once per panorama; they change with `src`.
  const hotspotsRef = useRef(hotspots)
  hotspotsRef.current = hotspots
  const yawRef = useRef(yaw)
  yawRef.current = yaw
  const vaovRef = useRef(vaov)
  vaovRef.current = vaov
  const yawOffsetRef = useRef(yawOffset)
  yawOffsetRef.current = yawOffset
  const onMotionModeRef = useRef(onMotionMode)
  onMotionModeRef.current = onMotionMode

  useEffect(() => {
    let mounted = true

    async function initViewer() {
      if (!containerRef.current) return

      // Load Pannellum script if not already loaded
      if (!window.pannellum) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Pannellum'))
          document.head.appendChild(script)
        })
      }

      if (!mounted || !containerRef.current || !window.pannellum) return

      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }

      const portrait = window.innerHeight > window.innerWidth
      const partial = vaovRef.current < 180
      const baseHfov = portrait ? PORTRAIT_HFOV : LANDSCAPE_HFOV
      const maxFit = partial ? fitHfov(vaovRef.current, window.innerWidth, window.innerHeight) : Infinity
      const hfov = Math.min(baseHfov, maxFit)
      setLoaded(false)
      viewerRef.current = window.pannellum.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: src,
        // Explicit so any image aspect (e.g. the model's 3:2) wraps the sphere.
        haov: 360,
        vaov: vaovRef.current,
        // For a partial band, stop the view at its edges instead of showing void.
        // Pannellum's background check needs explicit pitch limits (otherwise its
        // hfov becomes NaN and the viewer never loads).
        avoidShowingBackground: partial,
        ...(partial && { minPitch: -vaovRef.current / 2, maxPitch: vaovRef.current / 2 }),
        autoLoad: true,
        showControls: false,
        compass: false,
        mouseZoom: true,
        hfov,
        minHfov: Math.min(20, hfov),
        maxHfov: Math.min(portrait ? 90 : 120, maxFit),
        friction: 0.15,
        yaw: yawRef.current,
        pitch: 0,
        backgroundColor: [30, 24, 18],
        hotSpots: hotspotsRef.current.map((h) => ({
          pitch: h.pitch,
          yaw: h.yaw,
          type: 'info',
          text: h.label,
          clickHandlerFunc: () => onHotspotClickRef.current?.(h.id),
        })),
      })

      viewerRef.current.on('load', () => {
        if (!mounted) return
        setLoaded(true)
        onLoadRef.current?.()
      })
    }

    initViewer()

    return () => {
      mounted = false
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [src])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !loaded || !motion) return

    let target: { heading: number; pitch: number } | null = null
    let current: { heading: number; pitch: number } | null = null
    // Without a compass, anchor the phone's starting direction to the current
    // view so turning on doesn't make the view jump.
    let relativeOffset: number | null = null
    let frame = 0

    const unsubscribe = watchOrientation((o) => {
      if (!target) onMotionModeRef.current?.(o.absolute ? 'compass' : 'relative')
      if (!o.absolute && relativeOffset === null) relativeOffset = angleDiff(viewer.getYaw(), o.heading)
      target = { heading: o.absolute ? o.heading : o.heading + (relativeOffset ?? 0), pitch: o.pitch }
    })
    const noSensor = setTimeout(() => {
      if (!target) onMotionModeRef.current?.('unavailable')
    }, SENSOR_WAIT_MS)

    const tick = () => {
      if (target) {
        const t = target
        const c: { heading: number; pitch: number } = current
          ? {
              heading: current.heading + angleDiff(t.heading, current.heading) * SMOOTHING,
              pitch: current.pitch + (t.pitch - current.pitch) * SMOOTHING,
            }
          : t
        current = c
        viewer.setYaw(toYawRange(c.heading + yawOffsetRef.current), false)
        viewer.setPitch(c.pitch, false)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      unsubscribe()
      clearTimeout(noSensor)
      cancelAnimationFrame(frame)
    }
  }, [motion, loaded])

  return (
    <div className="absolute inset-0 film-grain vignette">
      <div ref={containerRef} className="w-full h-full" style={{ backgroundColor: '#1e1812' }} />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[10px] tracking-[0.15em] text-muted/60 uppercase mt-4">Loading panorama</p>
          </div>
        </div>
      )}
    </div>
  )
}
