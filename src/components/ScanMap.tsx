'use client'

import { useEffect, useRef, useState } from 'react'
import { TILE_OPTIONS, TILE_URL } from '@/src/lib/basemap'
import type { ScanWithUrl } from '@/app/api/scans/route'

// Leaflet is loaded from the CDN (like Pannellum), so only the bits used here are typed.
interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer
  on(event: 'click', fn: () => void): LeafletLayer
  bindTooltip(text: string, options?: { direction?: string; offset?: [number, number] }): LeafletLayer
}
interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap
  fitBounds(bounds: [number, number][], options?: { padding?: [number, number]; maxZoom?: number }): LeafletMap
  remove(): void
}
interface Leaflet {
  map(el: HTMLElement, options: Record<string, unknown>): LeafletMap
  tileLayer(url: string, options: Record<string, unknown>): LeafletLayer
  circleMarker(latlng: [number, number], options: Record<string, unknown>): LeafletLayer
}

declare global {
  interface Window {
    L?: Leaflet
  }
}

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet'

function loadLeaflet(): Promise<Leaflet> {
  if (window.L) return Promise.resolve(window.L)
  if (!document.querySelector(`link[href="${LEAFLET}.css"]`)) {
    const css = document.createElement('link')
    css.rel = 'stylesheet'
    css.href = `${LEAFLET}.css`
    document.head.appendChild(css)
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${LEAFLET}.js`
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet missing')))
    script.onerror = () => reject(new Error('Failed to load Leaflet'))
    document.head.appendChild(script)
  })
}

interface ScanMapProps {
  // The scan being viewed, if any: it's highlighted and not clickable.
  currentScanId?: string
  // Where the map opens; otherwise it fits all scans.
  center?: { lat: number; lng: number } | null
  onPick: (scan: ScanWithUrl) => void
  // Vertical placement, so it can clear each screen's bottom controls.
  className?: string
}

// Minimap of saved scans, pinned bottom-right; tap a dot to hop into that scan.
export function ScanMap({ currentScanId, center, onPick, className = 'bottom-4' }: ScanMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scans, setScans] = useState<ScanWithUrl[]>([])
  // The latest callback, so re-renders don't rebuild the map.
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    fetch('/api/scans')
      .then((res) => (res.ok ? res.json() : { scans: [] }))
      .then((data: { scans: ScanWithUrl[] }) => setScans(data.scans))
      .catch(() => {})
  }, [])

  const centerLat = center?.lat
  const centerLng = center?.lng

  useEffect(() => {
    if (scans.length === 0) return
    let map: LeafletMap | null = null
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return
        map = L.map(containerRef.current, { zoomControl: false, attributionControl: true })
        L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map)

        if (centerLat !== undefined && centerLng !== undefined && (centerLat !== 0 || centerLng !== 0)) {
          map.setView([centerLat, centerLng], 16)
        } else {
          map.fitBounds(
            scans.map((s) => [s.lat, s.lng]),
            { padding: [16, 16], maxZoom: 16 }
          )
        }

        // Oldest first so the newest scan at a spot ends up on top.
        for (const scan of [...scans].reverse()) {
          const current = scan.id === currentScanId
          const marker = L.circleMarker([scan.lat, scan.lng], {
            radius: current ? 8 : 6,
            color: '#1e1812',
            weight: 2,
            fillColor: current ? '#e0c28a' : '#c06040',
            fillOpacity: 1,
          })
            .bindTooltip(current ? `${scan.year} · you are here` : `${scan.year}`, { direction: 'top', offset: [0, -6] })
            .addTo(map)
          if (!current) marker.on('click', () => onPickRef.current(scan))
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [scans, currentScanId, centerLat, centerLng])

  if (scans.length === 0) return null

  return (
    <div className={`scan-map fixed right-4 z-20 h-36 w-36 overflow-hidden rounded-md border border-border shadow-2xl md:h-44 md:w-64 ${className}`}>
      <div ref={containerRef} className="h-full w-full bg-surface" />
    </div>
  )
}
