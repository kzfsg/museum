'use client'

import { useEffect, useState } from 'react'
import { requestMotionPermission } from '@/src/lib/motion'

// Motion on by default for every panorama. `initial` is true when permission
// was granted earlier this session; otherwise ask once on mount. That resolves
// on Android and desktop (no prompt needed) and on iOS once motion was allowed
// earlier in the page session; where iOS still needs a tap it quietly fails.
// `checked` turns true once that first ask has settled.
export function useAutoMotion(initial: boolean): [boolean, (on: boolean) => void, boolean] {
  const [motion, setMotion] = useState(initial)
  const [checked, setChecked] = useState(initial)
  useEffect(() => {
    if (initial) return
    let live = true
    requestMotionPermission().then((ok) => {
      if (!live) return
      if (ok) setMotion(true)
      setChecked(true)
    })
    return () => {
      live = false
    }
  }, [initial])
  return [motion, setMotion, checked]
}
