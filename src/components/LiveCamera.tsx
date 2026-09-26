'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './chrome.module.css'
import { coverHfov, defaultHfov } from '@/src/lib/fov'

interface LiveCameraProps {
  // The horizontal FOV visible in the box (an aspect-based guess; the live
  // stream can't be measured like a scan). Re-reported when the box resizes.
  onHfov?: (hfov: number) => void
}

// The rear camera, full bleed. Stops the stream when unmounted.
export function LiveCamera({ onHfov }: LiveCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const onHfovRef = useRef(onHfov)
  onHfovRef.current = onHfov

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const report = () => {
      const { videoWidth: vw, videoHeight: vh, clientWidth: bw, clientHeight: bh } = video
      if (vw && vh && bw && bh) onHfovRef.current?.(coverHfov(defaultHfov(vw, vh), vw, vh, bw, bh))
    }
    // resize fires when the stream's dimensions change (e.g. the phone rotates).
    video.addEventListener('loadedmetadata', report)
    video.addEventListener('resize', report)
    const observer = new ResizeObserver(report)
    observer.observe(video)
    return () => {
      video.removeEventListener('loadedmetadata', report)
      video.removeEventListener('resize', report)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    const media = navigator.mediaDevices
    if (!media?.getUserMedia) {
      setError('no camera available in this browser.')
      return
    }
    media
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (videoRef.current) videoRef.current.srcObject = s
      })
      .catch(() => setError('camera access was denied or is unavailable.'))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <>
      <video ref={videoRef} autoPlay playsInline muted className={styles.camera} />
      {error && (
        <p className={styles.hint} style={{ position: 'absolute', inset: 'auto 16px 50%', margin: '0 auto' }} role="alert">
          {error}
        </p>
      )}
    </>
  )
}
