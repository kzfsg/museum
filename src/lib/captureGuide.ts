// Rules for the scan screen: when a frame may be captured, and what to tell
// the user. Kept pure so the thresholds are easy to test and tune.

// A scan is one photo every 30 degrees.
export const SCAN_SLOTS = 12

// Frames are only taken below this turning speed; faster ones come out blurred
// and, on iPhones, land at the wrong heading.
export const MAX_CAPTURE_SPEED = 40
// "Slow down" appears a little above the capture limit so it doesn't flicker.
export const SLOW_DOWN_SPEED = 50
// Frames tilted more than this from level are skipped; the preview is cropped
// to rows every frame covers, so tilted frames shrink it.
export const MAX_TILT_DEG = 10

// Cameras (notably iPhones) send black or very dark frames while starting up;
// frames are ignored for this long after the video starts playing.
export const CAMERA_WARMUP_MS = 1000
// Frames darker than this average luminance (0-255) are treated as a camera
// glitch and not kept, so their slot gets captured again.
export const MIN_FRAME_LUMINANCE = 16

// `rgba` is canvas ImageData.data.
export function isUsableFrame(rgba: ArrayLike<number>): boolean {
  let sum = 0
  const pixels = rgba.length / 4
  for (let i = 0; i < rgba.length; i += 4) sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
  return pixels > 0 && sum / pixels >= MIN_FRAME_LUMINANCE
}

export type GuideStatus = 'no-sensor' | 'too-fast' | 'tilted' | 'fill-gaps' | 'turning' | 'done'

export interface GuideInput {
  hasSensor: boolean
  speed: number
  pitch: number
  filled: number
  total: number
  // Total rotation so far, in degrees, regardless of direction.
  turnedDeg: number
}

export function canCapture(input: Pick<GuideInput, 'speed' | 'pitch'>): boolean {
  return input.speed <= MAX_CAPTURE_SPEED && Math.abs(input.pitch) <= MAX_TILT_DEG
}

export function guide(input: GuideInput): { status: GuideStatus; message: string } {
  if (!input.hasSensor) return { status: 'no-sensor', message: 'turn on motion, then turn slowly in place. photos are taken as you go' }
  if (input.filled >= input.total) return { status: 'done', message: 'got it' }
  if (input.speed > SLOW_DOWN_SPEED) return { status: 'too-fast', message: 'slow down, turn more slowly' }
  if (Math.abs(input.pitch) > MAX_TILT_DEG) {
    return { status: 'tilted', message: input.pitch > 0 ? 'tilt down, hold your phone level' : 'tilt up, hold your phone level' }
  }
  if (input.turnedDeg >= 360) return { status: 'fill-gaps', message: 'almost there, turn back to fill the empty dots' }
  return { status: 'turning', message: 'hold your phone upright and turn slowly to your right' }
}
