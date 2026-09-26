'use client'

import { useEffect, useRef } from 'react'
import styles from './Splash.module.css'

const landmarks = ['liberty', 'times-square', 'brooklyn'] as const
const PAIRS = 9

/** One timeline drives both sides: opposite frames always share a landmark and phase. */
export function TimeRibbon() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return
    const frames = Array.from(element.querySelectorAll<HTMLElement>('[data-frame]'))
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = element.clientWidth
    let elapsed = 0
    let last = 0
    let raf = 0

    function draw() {
      for (let pair = 0; pair < PAIRS; pair++) {
        const phase = (pair / PAIRS + elapsed / 32000) % 1
        const distance = (Math.pow(5, phase) - 1) / 4
        const x = 22 + distance * (width / 2 + 180)
        const scale = 0.24 + distance * 1.25
        for (let side = 0; side < 2; side++) {
          const frame = frames[pair * 2 + side]
          const direction = side === 0 ? -1 : 1
          frame.style.transform = `translate(-50%, -50%) translateX(${direction * x}px) perspective(900px) rotateY(${-direction * distance * 52}deg) scale(${scale})`
          frame.style.opacity = String(Math.min(1, phase * 18))
          frame.style.zIndex = String(Math.round(phase * 100))
        }
      }
    }
    function tick(now: number) {
      elapsed += Math.min(now - last, 64)
      last = now
      draw()
      raf = requestAnimationFrame(tick)
    }
    function sync() {
      cancelAnimationFrame(raf)
      draw()
      if (!motion.matches && !document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }
    const resize = new ResizeObserver(() => {
      width = element.clientWidth
      draw()
    })
    resize.observe(element)
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      cancelAnimationFrame(raf)
      resize.disconnect()
      motion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return (
    <div className={styles.ribbon} ref={host} role="img" aria-label="AI-generated reconstructions of the Statue of Liberty, Times Square and Brooklyn Bridge: the past on the left, the present on the right, from matching viewpoints.">
      {Array.from({ length: PAIRS }, (_, pair) => [0, 1].map(side => (
        <div
          key={`${pair}-${side}`}
          data-frame
          className={styles.photo}
          aria-hidden="true"
          style={{
            backgroundImage: `url(/images/time-machine/${landmarks[pair % landmarks.length]}.jpg)`,
            backgroundPosition: side === 0 ? 'left center' : 'right center',
          }}
        />
      )))}
      <div className={styles.eraLabels} aria-hidden="true"><span>then</span><span>now</span></div>
    </div>
  )
}
