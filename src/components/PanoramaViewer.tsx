'use client'

import { useEffect, useRef, useState } from 'react'
import { angleDiff, toYawRange, watchOrientation, type Orientation } from '@/src/lib/motion'

interface PannellumViewer {
  destroy: () => void
  on: (event: string, cb: () => void) => void
  startOrientation: () => void
  stopOrientation: () => void
  isOrientationSupported: () => boolean
  setYaw: (yaw: number, animated?: number | false) => void
  setPitch: (pitch: number, animated?: number | false) => void
}

export type MotionMode = 'compass' | 'relative'

// Fraction of the remaining angle closed each frame; lower is smoother but laggier.
const SMOOTHING = 0.15
// If no compass reading arrives in this time, fall back to Pannellum's own
// relative orientation tracking.
const COMPASS_WAIT_MS = 1500

declare global {
  interface Window {
    pannellum?: {
      viewer: (container: string | HTMLElement, config: Record<string, unknown>) => PannellumViewer
    }
  }
}

export interface PanoramaHotspot {
  id: string
  pitch: number
  yaw: number
  label: string
}

interface PanoramaViewerProps {
  src: string
  hotspots?: PanoramaHotspot[]
  onHotspotClick?: (id: string) => void
  // Pan the view by moving the phone. Uses the compass so the panorama's yaw
  // matches real-world heading, falling back to relative tracking.
  motion?: boolean
  // Manual correction (degrees) added to the compass heading.
  yawOffset?: number
  onMotionMode?: (mode: MotionMode) => void
  // Initial view direction; for scans this equals the compass heading.
  yaw?: number
  onLoad?: () => void
}

export function PanoramaViewer({
  src,
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
  // Hotspots are read once per panorama; they change together with `src`.
  const hotspotsRef = useRef(hotspots)
  hotspotsRef.current = hotspots
  const yawRef = useRef(yaw)
  yawRef.current = yaw
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

      setLoaded(false)
      viewerRef.current = window.pannellum.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: src,
        // Explicit so any image aspect (e.g. the model's 3:2) wraps the full sphere.
        haov: 360,
        vaov: 180,
        autoLoad: true,
        showControls: false,
        compass: false,
        mouseZoom: true,
        hfov: 100,
        minHfov: 50,
        maxHfov: 120,
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

    let target: Orientation | null = null
    let current: Orientation | null = null
    let usingRelative = false
    let frame = 0

    const unsubscribe = watchOrientation((o) => {
      if (!target) onMotionModeRef.current?.('compass')
      target = o
    })
    const fallback = setTimeout(() => {
      if (target) return
      usingRelative = true
      viewer.startOrientation()
      onMotionModeRef.current?.('relative')
    }, COMPASS_WAIT_MS)

    const tick = () => {
      if (target) {
        current = current
          ? {
              heading: current.heading + angleDiff(target.heading, current.heading) * SMOOTHING,
              pitch: current.pitch + (target.pitch - current.pitch) * SMOOTHING,
            }
          : target
        viewer.setYaw(toYawRange(current.heading + yawOffsetRef.current), false)
        viewer.setPitch(current.pitch, false)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      unsubscribe()
      clearTimeout(fallback)
      cancelAnimationFrame(frame)
      if (usingRelative) viewer.stopOrientation()
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
