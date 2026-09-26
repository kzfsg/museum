'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Compass, Headphones, History, Map as MapIcon, Mic, MicOff, Rows2, SlidersHorizontal, X } from 'lucide-react'
import styles from './chrome.module.css'
import dynamic from 'next/dynamic'
import type { Place } from '@/src/data/places'
import { requestMotionPermission } from '@/src/lib/motion'
import { useAutoMotion } from '@/src/lib/useAutoMotion'
import type { MotionMode, PannellumViewer } from '@/src/components/PanoramaViewer'
import { readView, syncViews, type View } from '@/src/lib/viewSync'
import { ScanMapView, useSavedScans } from '@/src/components/ScanMap'
import { useTourGuide } from '@/src/components/useTourGuide'
import type { ScanWithUrl } from '@/app/api/scans/route'
import type { Background } from '@/src/components/ScanReview'

const PanoramaViewer = dynamic(
  () => import('@/src/components/PanoramaViewer').then((mod) => mod.PanoramaViewer),
  { ssr: false }
)

const TIDBITS_SEEN = 'museum.tidbitsSeen'

interface ExploreProps {
  place: Place
  onBack: () => void
  // Hop into another saved scan from the minimap.
  onPickScan: (scan: ScanWithUrl) => void
  // Start with motion on (permission was already granted earlier in the session).
  autoMotion?: boolean
  // The user's own scan, developing while they browse this one.
  background?: Background | null
  onOpenBackground?: () => void
  onDismissBackground?: () => void
}

export function Explore({
  place,
  onBack,
  onPickScan,
  autoMotion = false,
  background,
  onOpenBackground,
  onDismissBackground,
}: ExploreProps) {
  const [motion, setMotion] = useAutoMotion(autoMotion)
  // Only complain about missing sensors if the user turned motion on themselves.
  const [userAskedForMotion, setUserAskedForMotion] = useState(false)
  const [alignOpen, setAlignOpen] = useState(false)
  const [noteDismissed, setNoteDismissed] = useState(false)
  const [motionError, setMotionError] = useState<string | null>(null)
  const [motionMode, setMotionMode] = useState<MotionMode | null>(null)
  const [yawOffset, setYawOffset] = useState(0)
  const [openTidbitId, setOpenTidbitId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [split, setSplit] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  // The tidbits button pulses until the user has opened a tidbit once (ever, on this device).
  const [tidbitsSeen, setTidbitsSeen] = useState(true)
  useEffect(() => {
    try {
      setTidbitsSeen(localStorage.getItem(TIDBITS_SEEN) === '1')
    } catch {}
  }, [])
  useEffect(() => {
    if (tidbitsSeen || !(listOpen || openTidbitId)) return
    setTidbitsSeen(true)
    try {
      localStorage.setItem(TIDBITS_SEEN, '1')
    } catch {}
  }, [tidbitsSeen, listOpen, openTidbitId])
  const scans = useSavedScans()
  // Where the view pointed when the layout last changed, so switching keeps it.
  const [resume, setResume] = useState<View | null>(null)
  const thenViewer = useRef<PannellumViewer | null>(null)
  const nowViewer = useRef<PannellumViewer | null>(null)
  const splitShown = split && Boolean(place.present)
  const guide = useTourGuide(place, thenViewer)
  const guideOn = guide.status !== 'off'

  // Keep the two panes looking the same way. Only the top pane follows the
  // phone; the bottom one copies it (and either can be dragged).
  useEffect(() => {
    if (!splitShown) return
    let last: View | null = null
    let frame = 0
    const tick = () => {
      if (thenViewer.current && nowViewer.current) last = syncViews(thenViewer.current, nowViewer.current, last)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [splitShown])

  function toggleSplit() {
    if (thenViewer.current) setResume(readView(thenViewer.current))
    setSplit((on) => !on)
  }

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

  // The past, with hotspots and phone steering; full screen or the top pane.
  const thenView = (
    <PanoramaViewer
      src={place.panorama}
      vaov={place.vaov}
      vOffset={place.vOffset}
      hfov={resume?.hfov ?? place.viewHfov}
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
      yaw={resume?.yaw ?? place.startYaw}
      pitch={resume?.pitch}
      onViewer={(v) => (thenViewer.current = v)}
    />
  )

  return (
    <main className={styles.screen}>
      {splitShown ? (
        <div className={styles.split}>
          <div className={styles.pane}>
            {thenView}
            <span className={`${styles.paneLabel} ${styles.paneLabelAbove}`}>{place.year}</span>
          </div>
          <div className={styles.pane}>
            <PanoramaViewer
              src={place.present!}
              hfov={resume?.hfov ?? place.viewHfov}
              yaw={resume?.yaw ?? place.startYaw}
              pitch={resume?.pitch}
              onViewer={(v) => (nowViewer.current = v)}
            />
            <span className={`${styles.paneLabel} ${styles.paneLabelBelow}`}>today</span>
          </div>
        </div>
      ) : (
        thenView
      )}

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
        {/* Opened from the map button; in the footer's flow so it sits above the hints and
            buttons instead of covering them. Not in split view (it would cover "today"). */}
        {mapOpen && scans && scans.length > 0 && !splitShown && (
          <div className={`h-48 w-full max-w-sm self-end md:w-64 ${styles.minimap}`}>
            <ScanMapView
              scans={scans}
              currentScanId={place.id.startsWith('scan-') ? place.id.slice('scan-'.length) : undefined}
              center={place}
              zoom={17}
              onPick={(scan) => {
                setMapOpen(false)
                onPickScan(scan)
              }}
              className="h-full w-full"
            />
          </div>
        )}
        {background?.status === 'developing' && (
          <p className={styles.waiting} aria-live="polite">
            your {background.year} is still developing…
          </p>
        )}
        {background?.status === 'ready' && (
          <button onClick={onOpenBackground} className={`${styles.pill} ${styles.ink} ${styles.primary}`}>
            your {background.year} is ready, view it
            <ArrowUpRight size={19} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
        {background?.status === 'failed' && (
          <p className={styles.hint} role="alert">
            your {background.year} couldn’t be made: {background.message}{' '}
            <button onClick={onDismissBackground} className={styles.bare} aria-label="dismiss">
              <X size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </p>
        )}
        {guideOn && guide.caption && (
          <p className={`${styles.hint} ${styles.caption}`} aria-live="polite">
            {guide.caption}
          </p>
        )}
        {guide.error && <p className={styles.hint}>{guide.error}</p>}
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
          <button
            onClick={toggleMotion}
            aria-pressed={motion}
            aria-label={!motion ? 'use motion' : motionMode === 'compass' ? 'compass on' : 'motion on'}
            title={!motion ? 'use motion' : motionMode === 'compass' ? 'compass on' : 'motion on'}
            className={`${styles.pill} ${styles.round} ${motion ? styles.ink : ''}`}
          >
            <Compass size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {motion && motionMode === 'compass' && (
            <button
              onClick={() => setAlignOpen((open) => !open)}
              aria-pressed={alignOpen}
              aria-label={alignOpen ? 'done aligning' : 'align'}
              title={alignOpen ? 'done aligning' : 'align'}
              className={`${styles.pill} ${styles.round} ${alignOpen ? styles.ink : ''}`}
            >
              <SlidersHorizontal size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={guide.toggle}
            aria-pressed={guideOn}
            aria-busy={guide.status === 'connecting'}
            aria-label={guide.status === 'connecting' ? 'calling guide…' : guideOn ? 'end tour' : 'tour guide'}
            title={guide.status === 'connecting' ? 'calling guide…' : guideOn ? 'end tour' : 'tour guide'}
            className={`${styles.pill} ${styles.round} ${guideOn ? styles.ink : ''}`}
          >
            <Headphones size={17} strokeWidth={1.75} aria-hidden="true" />
          </button>
          {guide.status === 'live' && (
            <button
              onClick={guide.toggleMute}
              aria-pressed={guide.muted}
              aria-label={guide.muted ? 'unmute microphone' : 'mute microphone'}
              title={guide.muted ? 'unmute microphone' : 'mute microphone'}
              className={`${styles.pill} ${styles.round}`}
            >
              {guide.muted ? <MicOff size={17} strokeWidth={1.75} aria-hidden="true" /> : <Mic size={17} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          )}
          {place.present && (
            <button
              onClick={toggleSplit}
              aria-pressed={split}
              aria-label={split ? 'show only the past' : 'compare with today'}
              title={split ? 'show only the past' : 'compare with today'}
              className={`${styles.pill} ${styles.round} ${split ? styles.ink : ''}`}
            >
              <Rows2 size={17} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          {place.tidbits.length > 0 && (
            <button
              onClick={() => setListOpen(true)}
              aria-label={`tidbits (${place.tidbits.length})`}
              title={`tidbits (${place.tidbits.length})`}
              className={`${styles.pill} ${styles.round} ${tidbitsSeen ? '' : `${styles.ink} ${styles.beckon}`}`}
            >
              <BookOpen size={17} strokeWidth={1.75} aria-hidden="true" />
              {!tidbitsSeen && (
                <span className={styles.badge} aria-hidden="true">
                  {place.tidbits.length}
                </span>
              )}
            </button>
          )}
          {scans && scans.length > 0 && !splitShown && (
            <button
              onClick={() => setMapOpen((open) => !open)}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? 'hide map' : 'map of nearby scans'}
              title={mapOpen ? 'hide map' : 'map of nearby scans'}
              className={`${styles.pill} ${styles.round} ${mapOpen ? styles.ink : ''}`}
            >
              <MapIcon size={17} strokeWidth={1.75} aria-hidden="true" />
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
