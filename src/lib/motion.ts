// iOS only grants device orientation after a user gesture asks for it, so call
// this first thing inside a click handler.
export async function requestMotionPermission(): Promise<boolean> {
  const DOE = globalThis.DeviceOrientationEvent as unknown as
    | { requestPermission?: () => Promise<'granted' | 'denied'> }
    | undefined
  if (!DOE) return false
  if (typeof DOE.requestPermission !== 'function') return true
  try {
    return (await DOE.requestPermission()) === 'granted'
  } catch {
    return false
  }
}

// Compass heading (0 = north, clockwise) of the direction the back camera faces,
// for a phone held upright. Follows the W3C DeviceOrientation spec example.
function headingFromEuler(alpha: number, beta: number, gamma: number): number {
  const rad = Math.PI / 180
  const cX = Math.cos(beta * rad)
  const cY = Math.cos(gamma * rad)
  const cZ = Math.cos(alpha * rad)
  const sX = Math.sin(beta * rad)
  const sY = Math.sin(gamma * rad)
  const sZ = Math.sin(alpha * rad)
  const vx = -cZ * sY - sZ * sX * cY
  const vy = -sZ * sY + cZ * sX * cY
  let heading = Math.atan(vx / vy)
  if (vy < 0) heading += Math.PI
  else if (vx < 0) heading += 2 * Math.PI
  return heading / rad
}

// Calls `onHeading` with compass headings. Returns an unsubscribe function.
// Never fires on devices without an absolute compass (e.g. laptops).
export function watchHeading(onHeading: (deg: number) => void): () => void {
  const handle = (e: DeviceOrientationEvent) => {
    const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
    if (typeof ios === 'number') {
      onHeading(ios)
      return
    }
    if (e.absolute && e.alpha != null && e.beta != null && e.gamma != null) {
      onHeading(headingFromEuler(e.alpha, e.beta, e.gamma))
    }
  }
  // Android Chrome reports compass-referenced values only on the "absolute" event.
  window.addEventListener('deviceorientationabsolute', handle as EventListener)
  window.addEventListener('deviceorientation', handle)
  return () => {
    window.removeEventListener('deviceorientationabsolute', handle as EventListener)
    window.removeEventListener('deviceorientation', handle)
  }
}

// Smallest signed difference a - b in degrees, in [-180, 180).
export function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}
