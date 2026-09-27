'use client'

import { ArrowLeft } from 'lucide-react'
import styles from './chrome.module.css'
import { ScanMapView, useSavedScanLibrary } from '@/src/components/ScanMap'
import mapStyles from './MapScreen.module.css'
import type { ScanWithUrl } from '@/app/api/scans/route'

interface MapScreenProps {
  // The user's position, if known; the map opens there.
  here?: { lat: number; lng: number } | null
  onPick: (scan: ScanWithUrl) => void
  onBack: () => void
  backLabel?: string
}

// Full-screen map of every saved scan, opened over the camera.
export function MapScreen({ here, onPick, onBack, backLabel = 'back to scan' }: MapScreenProps) {
  const { scans, error, retry } = useSavedScanLibrary()

  return (
    <div className={`${styles.screen} ${styles.mapScreen}`} role="dialog" aria-modal="true" aria-label="map of saved scans">
      {scans && <ScanMapView scans={scans} here={here} onPick={onPick} photoMarkers className="absolute inset-0" />}

      <header className={styles.top}>
        <button onClick={onBack} className={styles.pill}>
          <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" />
          {backLabel}
        </button>
      </header>

      <section className={mapStyles.library} aria-label="saved panoramas">
        <div className={mapStyles.heading}>
          <h1>the past, saved here</h1>
          <p aria-live="polite">
          {error ? error : scans === null
            ? 'loading saved scans…'
            : scans.length === 0
              ? 'no saved scans yet. yours will be the first.'
              : `${scans.length} saved panoramas · open one without generating again`}
          </p>
          {error && <button className={styles.pill} onClick={retry}>try again</button>}
        </div>
        {scans && scans.length > 0 && <ul className={mapStyles.photos}>
          {scans.map((scan) => <li key={scan.id}>
            <button onClick={() => onPick(scan)} className={mapStyles.photo} aria-label={`explore saved panorama from ${scan.year}, captured ${new Date(scan.createdAt).toLocaleDateString()}`}>
              {/* Private images are streamed through the app and cached by the browser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scan.imageUrl} alt="" loading="lazy" />
              <span><strong>{scan.year}</strong><small>open saved view</small></span>
            </button>
          </li>)}
        </ul>}
      </section>
    </div>
  )
}
