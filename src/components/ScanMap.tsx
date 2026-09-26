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
// Where the map opens with nothing to show: Manhattan.
const NYC: [number, number] = [40.758, -73.9855]

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

// Saved scans, newest first; null while loading.
export function useSavedScans(): ScanWithUrl[] | null {
  const [scans, setScans] = useState<ScanWithUrl[] | null>(null)
  useEffect(() => {
    fetch('/api/scans')
      .then((res) => (res.ok ? res.json() : { scans: [] }))
      .then((data: { scans: ScanWithUrl[] }) => setScans(data.scans))
      .catch(() => setScans([]))
  }, [])
  return scans
}

type LatLng = { lat: number; lng: number }

// 0,0 means "unknown" (e.g. a scan made without location).
function known(p?: LatLng | null): p is LatLng {
  return Boolean(p && (p.lat !== 0 || p.lng !== 0))
}

interface ScanMapViewProps {
  scans: ScanWithUrl[]
  // The scan being viewed, if any: it's highlighted and not clickable.
  currentScanId?: string
  // Where the map opens; otherwise the user's position, then all scans.
  center?: LatLng | null
  // The user's own position, drawn as a separate dot.
  here?: LatLng | null
  zoom?: number
  onPick: (scan: ScanWithUrl) => void
  className?: string
}

// A Leaflet map of saved scans that fills its box; tap a dot to open that scan.
export function ScanMapView({ scans, currentScanId, center, here, zoom = 16, onPick, className = '' }: ScanMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The latest callback, so re-renders don't rebuild the map.
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  const centerLat = known(center) ? center.lat : null
  const centerLng = known(center) ? center.lng : null
  const hereLat = known(here) ? here.lat : null
  const hereLng = known(here) ? here.lng : null

  useEffect(() => {
    let map: LeafletMap | null = null
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current) return
        map = L.map(containerRef.current, { zoomControl: false, attributionControl: true })
        L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map)

        if (centerLat !== null && centerLng !== null) map.setView([centerLat, centerLng], zoom)
        else if (hereLat !== null && hereLng !== null) map.setView([hereLat, hereLng], zoom)
        else if (scans.length > 0) map.fitBounds(scans.map((s) => [s.lat, s.lng]), { padding: [24, 24], maxZoom: zoom })
        else map.setView(NYC, 12)

        if (hereLat !== null && hereLng !== null) {
          L.circleMarker([hereLat, hereLng], {
            radius: 7,
            color: '#fafaf7',
            weight: 3,
            fillColor: '#42644c',
            fillOpacity: 1,
            interactive: false,
          }).addTo(map)
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
  }, [scans, currentScanId, centerLat, centerLng, hereLat, hereLng, zoom])

  return <div ref={containerRef} className={`scan-map isolate bg-surface ${className}`} />
}

interface ScanMapProps {
  currentScanId?: string
  center?: LatLng | null
  onPick: (scan: ScanWithUrl) => void
  // Vertical placement, so it can clear each screen's bottom controls.
  className?: string
}

// Minimap of saved scans, pinned bottom-right; hidden when there are none.
export function ScanMap({ currentScanId, center, onPick, className = 'bottom-4' }: ScanMapProps) {
  const scans = useSavedScans()
  if (!scans || scans.length === 0) return null

  return (
    <div className={`fixed right-4 z-20 h-36 w-36 overflow-hidden rounded-md border border-border shadow-2xl md:h-44 md:w-64 ${className}`}>
      <ScanMapView scans={scans} currentScanId={currentScanId} center={center} onPick={onPick} className="h-full w-full" />
    </div>
  )
}
