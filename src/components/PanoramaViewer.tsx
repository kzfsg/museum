'use client'

import { useEffect, useRef, useState } from 'react'

interface PannellumViewer {
  destroy: () => void
  on: (event: string, cb: () => void) => void
  startOrientation: () => void
  stopOrientation: () => void
  isOrientationSupported: () => boolean
}

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
  // Pan the view by moving the phone (device orientation).
  motion?: boolean
  onLoad?: () => void
}

export function PanoramaViewer({ src, hotspots = [], onHotspotClick, motion = false, onLoad }: PanoramaViewerProps) {
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
        autoLoad: true,
        showControls: false,
        compass: false,
        mouseZoom: true,
        hfov: 100,
        minHfov: 50,
        maxHfov: 120,
        friction: 0.15,
        yaw: 0,
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
    if (!viewer || !loaded) return
    if (motion) viewer.startOrientation()
    else viewer.stopOrientation()
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
