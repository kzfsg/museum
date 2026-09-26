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
export function headingFromEuler(alpha: number, beta: number, gamma: number): number {
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

export interface Orientation {
  // Compass heading of the back camera, 0 = north, clockwise.
  heading: number
  // Degrees above the horizon the camera points (0 when the phone is upright).
  pitch: number
}

// Calls `onOrientation` with compass-referenced readings. Returns an unsubscribe
// function. Never fires on devices without an absolute compass (e.g. laptops).
export function watchOrientation(onOrientation: (o: Orientation) => void): () => void {
  const handle = (e: DeviceOrientationEvent) => {
    if (e.beta == null) return
    // beta is 90 when the phone is held upright in portrait.
    const pitch = Math.max(-85, Math.min(85, e.beta - 90))
    const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
    if (typeof ios === 'number') {
      onOrientation({ heading: ios, pitch })
      return
    }
    if (e.absolute && e.alpha != null && e.gamma != null) {
      onOrientation({ heading: headingFromEuler(e.alpha, e.beta, e.gamma), pitch })
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

export function watchHeading(onHeading: (deg: number) => void): () => void {
  return watchOrientation((o) => onHeading(o.heading))
}

// Smallest signed difference a - b in degrees, in [-180, 180).
export function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}

// Normalizes degrees to Pannellum's yaw range [-180, 180).
export function toYawRange(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}
