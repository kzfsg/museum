'use client'

import { useState } from 'react'
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
      setMotionError('Motion isn’t available here. Drag to look around.')
    }
  }

  return (
    <main className="fixed inset-0">
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
            if (userAskedForMotion) setMotionError('No motion sensor here. Drag to look around.')
          }
        }}
        yaw={place.startYaw}
      />

      <header className="absolute top-0 inset-x-0 z-20 flex items-start justify-between gap-4 p-4 hud-backdrop">
        <button onClick={onBack} className="text-sm text-muted">← Back</button>
        <div className="text-right">
          <div className="font-display text-lg">{place.name}</div>
          <div className="text-xs text-muted">
            {place.neighborhood} · {place.year}
            {place.placeholder && ' · placeholder'}
          </div>
        </div>
      </header>

      {place.note && !noteDismissed && (
        <button
          onClick={() => setNoteDismissed(true)}
          className="absolute inset-x-4 top-20 z-20 rounded-md bg-surface/90 px-4 py-3 text-left text-sm"
        >
          {place.note}
          <span className="ml-2 text-xs text-muted">Tap to hide</span>
        </button>
      )}

      <footer className="absolute bottom-0 inset-x-0 z-20 p-4 space-y-2">
        {motionError && <p className="text-xs text-muted text-center">{motionError}</p>}
        {motion && motionMode === 'relative' && (
          <p className="text-xs text-muted text-center">No compass on this device, so the view follows your turns but isn’t tied to north.</p>
        )}
        {motion && motionMode === 'compass' && alignOpen && (
          <label className="flex items-center gap-3 rounded-md bg-surface/80 px-3 py-2 text-xs text-muted">
            <span className="shrink-0">Line it up</span>
            <input
              type="range"
              min={-180}
              max={180}
              value={yawOffset}
              onChange={(e) => setYawOffset(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <span className="w-10 shrink-0 text-right tabular-nums">{yawOffset}°</span>
          </label>
        )}
        <div className="flex gap-2 justify-center">
          <button onClick={toggleMotion} className="rounded-md border border-border bg-surface/80 px-4 py-2 text-sm">
            {!motion ? 'Use motion' : motionMode === 'compass' ? 'Compass on' : 'Motion on'}
          </button>
          {motion && motionMode === 'compass' && (
            <button
              onClick={() => setAlignOpen((open) => !open)}
              className="rounded-md border border-border bg-surface/80 px-4 py-2 text-sm"
            >
              {alignOpen ? 'Done aligning' : 'Align'}
            </button>
          )}
          {place.tidbits.length > 0 && (
            <button
              onClick={() => setListOpen(true)}
              className="rounded-md border border-border bg-surface/80 px-4 py-2 text-sm"
            >
              Tidbits ({place.tidbits.length})
            </button>
          )}
        </div>
      </footer>

      {(openTidbit || listOpen) && (
        <div
          className="absolute inset-0 z-30 flex items-end bg-black/40"
          onClick={() => {
            setOpenTidbitId(null)
            setListOpen(false)
          }}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[70dvh] overflow-y-auto rounded-t-xl bg-surface p-5"
          >
            {openTidbit ? (
              <article className="space-y-2">
                <div className="text-[10px] uppercase tracking-[0.15em] text-accent">{openTidbit.kind}</div>
                <h3 className="font-display text-xl">{openTidbit.title}</h3>
                <p className="text-sm text-foreground/90">{openTidbit.body}</p>
                {openTidbit.source && (
                  <p className="text-xs text-muted">
                    Source:{' '}
                    {openTidbit.source.startsWith('https://') ? (
                      <a href={openTidbit.source} target="_blank" rel="noreferrer" className="underline">
                        {new URL(openTidbit.source).hostname}
                      </a>
                    ) : (
                      openTidbit.source
                    )}
                  </p>
                )}
                <button onClick={() => setOpenTidbitId(null)} className="text-sm text-muted pt-2">
                  {listOpen ? '← All tidbits' : 'Close'}
                </button>
              </article>
            ) : (
              <ul className="space-y-2">
                {place.tidbits.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => setOpenTidbitId(t.id)}
                      className="w-full text-left rounded-md border border-border px-4 py-3"
                    >
                      <div className="text-[10px] uppercase tracking-[0.15em] text-accent">{t.kind}</div>
                      <div className="font-medium">{t.title}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
