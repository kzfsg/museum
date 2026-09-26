'use client'

import { ArrowUpRight, History } from 'lucide-react'
import { ImageArc } from './ImageArc'
import styles from './Splash.module.css'

interface SplashProps {
  onScan: () => void
}

export function Splash({ onScan }: SplashProps) {
  return (
    <main className={styles.hero}>
      <div className={styles.wordmark}>time machine<History size={19} strokeWidth={1.5} aria-hidden="true" /></div>
      <div className={styles.intro}>
        <h1>travel back in time,</h1>
        <p>transform your new york<br />into a living museum</p>
      </div>
      <ImageArc stageId="hero-stage" />
      <div id="hero-stage" className={styles.ribbon} role="img" aria-label="AI-generated reconstructions of NYC landmarks: matching past views on the left and present views on the right." />
      <div className={styles.action}>
        <button onClick={onScan} className={styles.button}>
          travel back in time <ArrowUpRight size={19} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.subtitle}>
        <span>scan your surroundings in new york city, and step into a simulation of how it looked like decades ago.</span>
        <span>learn the history of your neighbourhoods, block by block</span>
      </p>
    </main>
  )
}
