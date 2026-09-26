'use client'

import { ArrowLeft } from 'lucide-react'
import styles from './chrome.module.css'
import { ScanMapView, useSavedScans } from '@/src/components/ScanMap'
import type { ScanWithUrl } from '@/app/api/scans/route'

interface MapScreenProps {
  // The user's position, if known; the map opens there.
  here?: { lat: number; lng: number } | null
  onPick: (scan: ScanWithUrl) => void
  onBack: () => void
}

// Full-screen map of every saved scan, opened over the camera.
export function MapScreen({ here, onPick, onBack }: MapScreenProps) {
  const scans = useSavedScans()

  return (
    <div className={`${styles.screen} ${styles.mapScreen}`} role="dialog" aria-modal="true" aria-label="map of saved scans">
      {scans && <ScanMapView scans={scans} here={here} onPick={onPick} className="absolute inset-0" />}

      <header className={styles.top}>
        <button onClick={onBack} className={styles.pill}>
          <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" />
          back to scan
        </button>
      </header>

      <div className={styles.bottom}>
        <p className={`${styles.pill} ${styles.wrap}`} aria-live="polite">
          {scans === null
            ? 'loading saved scans…'
            : scans.length === 0
              ? 'no saved scans yet. yours will be the first.'
              : 'tap a dot to step into that block’s past'}
        </p>
      </div>
    </div>
  )
}
