'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { ChevronRight, X } from 'lucide-react'
import { samples } from '@/src/data/samples'
import type { Place } from '@/src/data/places'
import styles from './chrome.module.css'

export function SamplesSheet({ open, onOpenChange, onPick }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (place: Place) => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${styles.screen} ${styles.overlay} ${styles.scrim}`}>
          <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
            <div className={styles.sheetHead}>
              <Dialog.Title className={styles.tidbitTitle}>samples</Dialog.Title>
              <Dialog.Close className={`${styles.pill} ${styles.round}`} aria-label="close samples">
                <X size={17} strokeWidth={1.75} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <ul className={styles.list}>
              {samples.map((place) => (
                <li key={place.id}>
                  <button className={styles.scanRow} onClick={() => onPick(place)}>
                    <span className={styles.scanThumb} style={{ backgroundImage: `url(${place.panorama})` }} aria-hidden="true" />
                    <span className={styles.scanRowText}>
                      <span>{place.name}</span>
                      <small>{place.year} · cached panorama</small>
                    </span>
                    <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
