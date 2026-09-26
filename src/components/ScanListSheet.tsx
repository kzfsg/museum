'use client'

import { createPortal } from 'react-dom'
import { ChevronRight, X } from 'lucide-react'
import styles from './chrome.module.css'
import { haversineKm } from '@/src/lib/geo'
import type { ScanWithUrl } from '@/app/api/scans/route'

interface ScanListSheetProps {
  title: string
  scans: ScanWithUrl[]
  // When known, each row shows how far away the scan is.
  here?: { lat: number; lng: number } | null
  onPick: (scan: ScanWithUrl) => void
  onClose: () => void
}

function distanceLabel(here: { lat: number; lng: number }, scan: ScanWithUrl): string {
  const m = haversineKm(here.lat, here.lng, scan.lat, scan.lng) * 1000
  return m < 25 ? 'right here' : m < 1000 ? `${Math.round(m / 10) * 10} m away` : `${(m / 1000).toFixed(1)} km away`
}

// A paper sheet listing saved scans, each with a strip of its panorama. Portaled
// to <body> so it can open from small containers like the minimap.
export function ScanListSheet({ title, scans, here, onPick, onClose }: ScanListSheetProps) {
  return createPortal(
    <div className={`${styles.screen} ${styles.overlay}`}>
      <div className={styles.scrim} onClick={onClose}>
        <section onClick={(e) => e.stopPropagation()} className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
          <div className={styles.sheetHead}>
            <h3 className={styles.tidbitTitle}>{title}</h3>
            <button onClick={onClose} className={`${styles.pill} ${styles.round}`} aria-label="close">
              <X size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <ul className={styles.list}>
            {scans.map((scan) => (
              <li key={scan.id}>
                <button onClick={() => onPick(scan)} className={styles.scanRow}>
                  <span className={styles.scanThumb} style={{ backgroundImage: `url(${scan.imageUrl})` }} aria-hidden="true" />
                  <span className={styles.scanRowText}>
                    <span>{scan.year}</span>
                    <small>
                      {here ? `${distanceLabel(here, scan)} · ` : ''}
                      scanned {new Date(scan.createdAt).toLocaleDateString()}
                    </small>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>,
    document.body
  )
}
