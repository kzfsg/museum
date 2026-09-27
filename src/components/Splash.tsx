'use client'

import { ArrowUpRight } from 'lucide-react'
import { TimeMachineIcon } from './TimeMachineIcon'
import { ImageArc } from './ImageArc'
import styles from './Splash.module.css'

interface SplashProps {
  onScan: () => void
  onDemo: () => void
  onQuickDemo: () => void
}

export function Splash({ onScan, onDemo, onQuickDemo }: SplashProps) {
  return (
    <main className={styles.hero}>
      <button type="button" className={styles.wordmark} onClick={onDemo} aria-label="time machine — open Times Square demo" title="Explore the Times Square demo">
        time machine<TimeMachineIcon size={19} strokeWidth={1.5} />
      </button>
      <div className={styles.intro}>
        <h1>travel back in time,</h1>
        <p>transform new york<br />into a living museum</p>
      </div>
      <ImageArc stageId="hero-stage" />
      <div id="hero-stage" className={styles.ribbon} role="img" aria-label="AI-generated reconstructions of NYC landmarks: matching past views on the left and present views on the right." />
      <div className={styles.action}>
        <button onClick={onScan} className={styles.button}>
          travel back in time <ArrowUpRight size={19} aria-hidden="true" />
        </button>
        <button onClick={onQuickDemo} className={`${styles.button} ${styles.secondary}`}>
          quick demo <ArrowUpRight size={19} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.subtitle}>
        <span>scan your surroundings in new york city, and step into a simulation of how it looked like decades ago.</span>
        <span>learn the history of your neighbourhoods, block by block</span>
      </p>
    </main>
  )
}
