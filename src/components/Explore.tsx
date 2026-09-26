'use client'

import { useState } from 'react'
import { ArrowLeft, BookOpen, ChevronRight, Compass, History, SlidersHorizontal, X } from 'lucide-react'
import styles from './chrome.module.css'
import dynamic from 'next/dynamic'
import type { Place } from '@/src/data/places'
import { requestMotionPermission } from '@/src/lib/motion'
import type { MotionMode } from '@/src/components/PanoramaViewer'

const PanoramaViewer = dynamic(
  () => import('@/src/components/PanoramaViewer').then((mod) => mod.PanoramaViewer),
  { ssr: false }
)

interface ExploreProps {
  place: Place
  onBack: () => void
  // Start with motion on (permission was already granted earlier in the session).
  autoMotion?: boolean
}

export function Explore({ place, onBack, autoMotion = false }: ExploreProps) {
  const [motion, setMotion] = useState(autoMotion)
  // Only complain about missing sensors if the user turned motion on themselves.
  const [userAskedForMotion, setUserAskedForMotion] = useState(false)
  const [alignOpen, setAlignOpen] = useState(false)
  const [noteDismissed, setNoteDismissed] = useState(false)
  const [motionError, setMotionError] = useState<string | null>(null)
  const [motionMode, setMotionMode] = useState<MotionMode | null>(null)
  const [yawOffset, setYawOffset] = useState(0)
  const [openTidbitId, setOpenTidbitId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)

  const openTidbit = place.tidbits.find((t) => t.id === openTidbitId)

  async function toggleMotion() {
    if (motion) {
      setMotion(false)
      setMotionMode(null)
      return
    }
    setUserAskedForMotion(true)
    if (await requestMotionPermission()) {
      setMotionError(null)
      setMotion(true)
    } else {
      setMotionError('motion isn’t available here. drag to look around.')
    }
  }

  return (
    <main className={styles.screen}>
      <PanoramaViewer
        src={place.panorama}
        vaov={place.vaov}
        vOffset={place.vOffset}
        hfov={place.viewHfov}
        hotspots={place.tidbits.map((t) => ({ id: t.id, pitch: t.pitch, yaw: t.yaw, label: t.title }))}
        onHotspotClick={setOpenTidbitId}
        motion={motion}
        yawOffset={yawOffset}
        onMotionMode={(mode) => {
          setMotionMode(mode)
          if (mode === 'unavailable') {
            setMotion(false)
            if (userAskedForMotion) setMotionError('no motion sensor here. drag to look around.')
          }
        }}
        yaw={place.startYaw}
      />

      <header className={styles.top}>
        <button onClick={onBack} className={styles.bare} aria-label="back">
          <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className={styles.meta}>
          <span className={styles.title}>{place.name}</span>
          <span className={styles.metaSub}>
            {place.neighborhood} · {place.year}
            {place.placeholder && ' · placeholder'}
          </span>
        </div>
      </header>

      {place.note && !noteDismissed && (
        <div className={styles.noteCard} role="status">
          <History size={18} strokeWidth={1.75} className={styles.noticeIcon} aria-hidden="true" />
          <p>{place.note}</p>
          <button onClick={() => setNoteDismissed(true)} className={`${styles.bare} ${styles.noteClose}`} aria-label="hide note">
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}

      <footer className={styles.bottom}>
        {motionError && <p className={styles.hint}>{motionError}</p>}
        {motion && motionMode === 'relative' && (
          <p className={styles.hint}>no compass on this device, so the view follows your turns but isn’t tied to north</p>
        )}
        {motion && motionMode === 'compass' && alignOpen && (
          <label className={styles.align}>
            <span>line it up</span>
            <input type="range" min={-180} max={180} value={yawOffset} onChange={(e) => setYawOffset(Number(e.target.value))} />
            <output>{yawOffset}°</output>
          </label>
        )}
        <div className={styles.row}>
          <button onClick={toggleMotion} aria-pressed={motion} className={`${styles.pill} ${motion ? styles.ink : ''}`}>
            <Compass size={17} strokeWidth={1.75} aria-hidden="true" />
            {!motion ? 'use motion' : motionMode === 'compass' ? 'compass on' : 'motion on'}
          </button>
          {motion && motionMode === 'compass' && (
            <button onClick={() => setAlignOpen((open) => !open)} aria-pressed={alignOpen} className={styles.pill}>
              <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
              {alignOpen ? 'done' : 'align'}
            </button>
          )}
          {place.tidbits.length > 0 && (
            <button onClick={() => setListOpen(true)} className={styles.pill}>
              <BookOpen size={17} strokeWidth={1.75} aria-hidden="true" />
              tidbits · {place.tidbits.length}
            </button>
          )}
        </div>
      </footer>

      {(openTidbit || listOpen) && (
        <div
          className={styles.scrim}
          onClick={() => {
            setOpenTidbitId(null)
            setListOpen(false)
          }}
        >
          <section onClick={(e) => e.stopPropagation()} className={styles.sheet} role="dialog" aria-modal="true" aria-label={openTidbit ? openTidbit.title : 'tidbits'}>
            {openTidbit ? (
              <article className={styles.stack}>
                <div className={styles.sheetHead}>
                  <h3 className={styles.tidbitTitle}>{openTidbit.title}</h3>
                  <button
                    onClick={() => setOpenTidbitId(null)}
                    className={`${styles.pill} ${styles.round}`}
                    aria-label={listOpen ? 'back to all tidbits' : 'close'}
                  >
                    {listOpen ? <ArrowLeft size={17} strokeWidth={1.75} aria-hidden="true" /> : <X size={17} strokeWidth={1.75} aria-hidden="true" />}
                  </button>
                </div>
                <p className={styles.tidbitBody}>{openTidbit.body}</p>
                <p className={styles.tidbitMeta}>
                  <span>{openTidbit.kind === 'local' ? 'local' : 'history'}</span>
                  {openTidbit.source && (
                    <span>
                      source:{' '}
                      {openTidbit.source.startsWith('https://') ? (
                        <a href={openTidbit.source} target="_blank" rel="noreferrer">
                          {new URL(openTidbit.source).hostname}
                        </a>
                      ) : (
                        openTidbit.source.toLowerCase()
                      )}
                    </span>
                  )}
                </p>
              </article>
            ) : (
              <>
                <div className={styles.sheetHead}>
                  <h3 className={styles.tidbitTitle}>around you</h3>
                  <button onClick={() => setListOpen(false)} className={`${styles.pill} ${styles.round}`} aria-label="close">
                    <X size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <ul className={styles.list}>
                  {place.tidbits.map((t) => (
                    <li key={t.id}>
                      <button onClick={() => setOpenTidbitId(t.id)} className={styles.listItem}>
                        <span>
                          {t.title}
                          <small>{t.kind === 'local' ? 'local' : 'history'}</small>
                        </span>
                        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
