'use client'

import { useEffect, useRef, useState } from 'react'
import { TILE_OPTIONS, TILE_URL } from '@/src/lib/basemap'
import { groupScans, type ScanGroup } from '@/src/lib/scanGroups'
import { ScanListSheet } from '@/src/components/ScanListSheet'
import type { ScanWithUrl } from '@/app/api/scans/route'

// Leaflet is loaded from the CDN (like Pannellum), so only the bits used here are typed.
interface LeafletLayer {
  addTo(map: LeafletMap): LeafletLayer
  on(event: 'click', fn: () => void): LeafletLayer
}
interface LeafletMap {
  setView(center: [number, number], zoom: number): LeafletMap
  fitBounds(bounds: [number, number][], options?: { padding?: [number, number]; paddingTopLeft?: [number, number]; paddingBottomRight?: [number, number]; maxZoom?: number }): LeafletMap
  remove(): void
}
interface Leaflet {
  map(el: HTMLElement, options: Record<string, unknown>): LeafletMap
  tileLayer(url: string, options: Record<string, unknown>): LeafletLayer
  marker(latlng: [number, number], options: Record<string, unknown>): LeafletLayer
  divIcon(options: Record<string, unknown>): unknown
}

declare global {
  interface Window {
    L?: Leaflet
  }
}

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet'
// Where the map opens with nothing to show: Manhattan.
const NYC: [number, number] = [40.758, -73.9855]
// Street level: close enough that nearby scans aren't a single clump.
const STREET_ZOOM = 18
// Dots are drawn small but the tap target is this big (px).
const TAP_TARGET = 44

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// A paper dot with an ink center, like the panorama's tidbit markers, with its
// year (or scan count) underneath.
function dotIcon(L: Leaflet, label: string, count: number, current: boolean, imageUrl?: string) {
  if (imageUrl && !current) {
    return L.divIcon({
      className: 'scan-photo',
      html: `<img src="${escapeHtml(imageUrl)}" alt="" /><span>${escapeHtml(label)}</span>`,
      iconSize: [88, 70], iconAnchor: [44, 35],
    })
  }
  const classes = ['scan-dot', current ? 'is-current' : '', count > 1 ? 'is-group' : ''].join(' ')
  return L.divIcon({
    className: classes,
    html: `<span class="scan-dot__dot">${count > 1 ? count : ''}</span><span class="scan-dot__label">${escapeHtml(label)}</span>`,
    iconSize: [TAP_TARGET, TAP_TARGET],
    iconAnchor: [TAP_TARGET / 2, TAP_TARGET / 2],
  })
}

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
export function useSavedScanLibrary() {
  const [scans, setScans] = useState<ScanWithUrl[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(null)
    fetch('/api/scans?limit=200', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load saved panoramas.')
        return res.json()
      })
      .then((data: { scans: ScanWithUrl[] }) => setScans(data.scans))
      .catch(() => { if (!controller.signal.aborted) setError('couldn’t load saved panoramas. try again.') })
    return () => controller.abort()
  }, [attempt])
  return { scans, error, retry: () => setAttempt((n) => n + 1) }
}

export function useSavedScans(): ScanWithUrl[] | null {
  return useSavedScanLibrary().scans
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
  photoMarkers?: boolean
}

// A Leaflet map of saved scans that fills its box; tap a dot to open that scan.
export function ScanMapView({ scans, currentScanId, center, here, zoom = STREET_ZOOM, onPick, className = '', photoMarkers = false }: ScanMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The latest callback, so re-renders don't rebuild the map.
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  // Several scans share the tapped dot: choose one from a list.
  const [openGroup, setOpenGroup] = useState<ScanGroup<ScanWithUrl> | null>(null)
  const [mapFailed, setMapFailed] = useState(false)

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
        else if (scans.length > 0) map.fitBounds(scans.map((s) => [s.lat, s.lng]), photoMarkers
          ? { paddingTopLeft: [56, 90], paddingBottomRight: [56, 310], maxZoom: 20 }
          : { padding: [56, 56], maxZoom: zoom })
        else map.setView(NYC, 13)

        if (hereLat !== null && hereLng !== null) {
          L.marker([hereLat, hereLng], {
            icon: L.divIcon({ className: 'scan-here', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
            interactive: false,
            keyboard: false,
            // Under the scan dots, which are what you tap.
            zIndexOffset: -1000,
          }).addTo(map)
        }

        // Photo pins need more separation than the compact minimap dots.
        for (const group of groupScans(scans, photoMarkers ? 40 : undefined)) {
          const current = group.scans.some((s) => s.id === currentScanId)
          const others = group.scans.filter((s) => s.id !== currentScanId)
          const label = current ? 'you are here' : group.scans.length > 1 ? `${group.scans.length} scans` : String(group.scans[0].year)
          const marker = L.marker([group.lat, group.lng], {
            icon: dotIcon(L, label, group.scans.length, current, photoMarkers ? group.scans[0].imageUrl : undefined),
            title: label,
            keyboard: others.length > 0,
            interactive: others.length > 0,
            riseOnHover: true,
            zIndexOffset: 1000,
          }).addTo(map)
          if (others.length === 1) marker.on('click', () => onPickRef.current(others[0]))
          else if (others.length > 1) marker.on('click', () => setOpenGroup({ ...group, scans: others }))
        }
      })
      .catch(() => { if (!cancelled) setMapFailed(true) })

    return () => {
      cancelled = true
      map?.remove()
    }
  }, [scans, currentScanId, centerLat, centerLng, hereLat, hereLng, zoom, photoMarkers])

  return (
    <>
      <div ref={containerRef} className={`scan-map isolate bg-[#fafaf7] ${className}`} />
      {mapFailed && <p role="status" className="absolute left-4 top-24 z-10 text-sm text-[#20211e]">{photoMarkers ? 'map unavailable. you can still open the saved photos below.' : 'map unavailable. please reopen it to try again.'}</p>}
      {openGroup && (
        <ScanListSheet
          title={`${openGroup.scans.length} scans here`}
          scans={openGroup.scans}
          onPick={(scan) => {
            setOpenGroup(null)
            onPickRef.current(scan)
          }}
          onClose={() => setOpenGroup(null)}
        />
      )}
    </>
  )
}
