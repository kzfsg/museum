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
  // Heading of the back camera, 0 = north, clockwise (see `absolute`).
  heading: number
  // Degrees above the horizon the camera points (0 when the phone is upright).
  pitch: number
  // True when `heading` is tied to real north; false when it is only relative
  // to wherever the phone pointed first (no compass available).
  absolute: boolean
  // Smoothed turning speed in degrees per second.
  speed: number
  // Gyro-only heading, never adjusted by the compass. Consistent between
  // readings (good for stitching) but not tied to north on iOS.
  rawHeading: number
}

export interface OrientationSample {
  alpha: number
  beta: number
  gamma: number
  // Whether alpha itself is compass-referenced (Android "absolute" events).
  absolute: boolean
  // iOS webkitCompassHeading, if present.
  compass?: number | null
  // Timestamp in ms.
  t: number
}

// Below this turning speed the phone counts as still, so the compass (which lags
// during turns) is trusted to correct north.
const STILL_SPEED = 25
// The compass keeps catching up for a moment after a turn ends, so it is only
// trusted once the phone has been still this long.
const COMPASS_SETTLE_MS = 800
// Fraction of the compass/gyro disagreement corrected per settled reading.
const COMPASS_BLEND = 0.05
const SPEED_SMOOTHING = 0.3

// Fuses readings into a heading that is fast (gyro-based alpha) and, when a
// compass exists, tied to north. iOS alpha is relative to an arbitrary start
// and webkitCompassHeading lags behind fast turns, so the compass only slowly
// corrects an offset on top of the gyro heading.
export class OrientationTracker {
  private compassOffset: number | null = null
  private last: { heading: number; t: number } | null = null
  private speed = 0
  private stillSince: number | null = null
  private sawAbsoluteEvent = false

  update(s: OrientationSample): Orientation | null {
    // Android fires both relative and absolute events; once absolute ones are
    // seen, ignore the relative ones.
    if (s.absolute) this.sawAbsoluteEvent = true
    else if (this.sawAbsoluteEvent) return null

    const raw = headingFromEuler(s.alpha, s.beta, s.gamma)
    if (!Number.isFinite(raw)) return null

    if (this.last) {
      const dt = (s.t - this.last.t) / 1000
      if (dt > 0) {
        const instant = Math.abs(angleDiff(raw, this.last.heading)) / dt
        this.speed += (instant - this.speed) * SPEED_SMOOTHING
      }
    }
    this.last = { heading: raw, t: s.t }
    if (this.speed >= STILL_SPEED) this.stillSince = null
    else if (this.stillSince === null) this.stillSince = s.t
    const settled = this.stillSince !== null && s.t - this.stillSince >= COMPASS_SETTLE_MS

    let heading = raw
    let absolute = s.absolute
    if (!s.absolute && typeof s.compass === 'number' && s.compass >= 0) {
      const target = angleDiff(s.compass, raw)
      if (this.compassOffset === null) this.compassOffset = target
      else if (settled) this.compassOffset += angleDiff(target, this.compassOffset) * COMPASS_BLEND
      heading = raw + this.compassOffset
      absolute = true
    }

    return {
      heading: normalizeDeg(heading),
      pitch: Math.max(-85, Math.min(85, s.beta - 90)),
      absolute,
      speed: this.speed,
      rawHeading: normalizeDeg(raw),
    }
  }
}

// Calls `onOrientation` for every usable reading. Returns an unsubscribe
// function. Never fires on devices without orientation sensors (e.g. laptops).
export function watchOrientation(onOrientation: (o: Orientation) => void): () => void {
  const tracker = new OrientationTracker()
  const handle = (e: DeviceOrientationEvent) => {
    if (e.alpha == null || e.beta == null || e.gamma == null) return
    const reading = tracker.update({
      alpha: e.alpha,
      beta: e.beta,
      gamma: e.gamma,
      absolute: e.absolute,
      compass: (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading,
      t: e.timeStamp,
    })
    if (reading) onOrientation(reading)
  }
  // Android Chrome reports compass-referenced values only on the "absolute" event.
  window.addEventListener('deviceorientationabsolute', handle as EventListener)
  window.addEventListener('deviceorientation', handle)
  return () => {
    window.removeEventListener('deviceorientationabsolute', handle as EventListener)
    window.removeEventListener('deviceorientation', handle)
  }
}

export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

// Average of angles (degrees), handling wrap-around: mean of 350 and 10 is 0.
export function circularMean(degs: number[]): number | null {
  if (degs.length === 0) return null
  let x = 0
  let y = 0
  for (const d of degs) {
    x += Math.cos((d * Math.PI) / 180)
    y += Math.sin((d * Math.PI) / 180)
  }
  return normalizeDeg((Math.atan2(y, x) * 180) / Math.PI)
}

// Smallest signed difference a - b in degrees, in [-180, 180).
export function angleDiff(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180
}

// Normalizes degrees to Pannellum's yaw range [-180, 180).
export function toYawRange(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}
