// The camera's horizontal field of view can't be read from the browser, and
// guessing wrong makes neighbouring frames repeat (too narrow) or leave gaps
// (too wide). So it is measured from the scan itself: for each pair of
// neighbouring frames, find the horizontal shift that best overlaps them; with
// the gyro angle between them, shift/angle gives pixels per degree.

// Horizontal FOV across the long side of a typical phone main camera (~24-26 mm
// equivalent lens).
const LONG_SIDE_FOV_DEG = 70

// Plausible range for a phone's portrait horizontal FOV.
export const MIN_HFOV = 30
export const MAX_HFOV = 100

// Default when measuring fails: derive the short-side FOV from the video's
// aspect ratio, since iPhones deliver 4:3 or 16:9 depending on the browser.
export function defaultHfov(width: number, height: number): number {
  const short = Math.min(width, height)
  const long = Math.max(width, height)
  const across = width <= height ? short / long : 1
  return (2 * Math.atan(Math.tan((LONG_SIDE_FOV_DEG * Math.PI) / 360) * across) * 180) / Math.PI
}

// A small grayscale image, normalized to zero mean and unit variance so that
// auto-exposure differences between frames don't affect matching.
export interface Gray {
  width: number
  height: number
  data: Float32Array
}

export function normalizeGray(width: number, height: number, luminance: ArrayLike<number>): Gray {
  const data = new Float32Array(width * height)
  let mean = 0
  for (let i = 0; i < data.length; i++) mean += luminance[i]
  mean /= data.length
  let variance = 0
  for (let i = 0; i < data.length; i++) variance += (luminance[i] - mean) ** 2
  const std = Math.sqrt(variance / data.length) || 1
  for (let i = 0; i < data.length; i++) data[i] = (luminance[i] - mean) / std
  return { width, height, data }
}

export interface PairMatch {
  // Pixels frame B's content sits left of where it appears in frame A.
  shift: number
  dy: number
  cost: number
  // Best cost relative to the typical cost; lower is a more distinctive match.
  distinctiveness: number
}

const MIN_OVERLAP_FRACTION = 0.12
const MAX_DY = 8
const ROW_STEP = 2

// B is to the right of A: B[x, y] shows what A shows at [x + shift, y + dy].
export function matchPair(a: Gray, b: Gray, minShift: number, maxShift: number): PairMatch | null {
  const w = a.width
  const h = a.height
  const lo = Math.max(1, Math.floor(minShift))
  const hi = Math.min(Math.floor(w * (1 - MIN_OVERLAP_FRACTION)), Math.ceil(maxShift))
  if (hi < lo) return null

  let best: PairMatch | null = null
  const costs: number[] = []
  for (let shift = lo; shift <= hi; shift++) {
    for (let dy = -MAX_DY; dy <= MAX_DY; dy += 2) {
      let sum = 0
      let n = 0
      const y0 = Math.max(0, -dy)
      const y1 = Math.min(h, h - dy)
      for (let y = y0; y < y1; y += ROW_STEP) {
        const rowA = (y + dy) * w + shift
        const rowB = y * w
        for (let x = 0; x < w - shift; x++) sum += Math.abs(a.data[rowA + x] - b.data[rowB + x])
        n += w - shift
      }
      const cost = sum / n
      costs.push(cost)
      if (!best || cost < best.cost) best = { shift, dy, cost, distinctiveness: 1 }
    }
  }
  if (!best) return null
  costs.sort((x, y) => x - y)
  const median = costs[Math.floor(costs.length / 2)]
  best.distinctiveness = median > 0 ? best.cost / median : 1
  return best
}

export interface FovFrame {
  heading: number
  gray: Gray
}

export interface FovEstimate {
  hfov: number
  measured: boolean
  pairs: number
}

// A match must be this much better than typical to count. Measured on
// synthetic scans: real overlaps score 0.03-0.47, unrelated frames 0.56+.
const MAX_DISTINCTIVENESS = 0.5
// Real pairs agree on one FOV; chance matches scatter. Require this many
// pairs within AGREEMENT of the median.
const MIN_AGREEING_PAIRS = 3
const AGREEMENT = 0.15

export function estimateHfov(frames: FovFrame[], fallback: number): FovEstimate {
  const sorted = [...frames].sort((p, q) => p.heading - q.heading)
  const estimates: number[] = []
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    const b = sorted[(i + 1) % sorted.length]
    const delta = (((b.heading - a.heading) % 360) + 360) % 360
    if (delta < 15 || delta > 45) continue
    const w = a.gray.width
    // shift = delta * w / hfov, searched over the plausible hfov range.
    const match = matchPair(a.gray, b.gray, (delta * w) / MAX_HFOV, (delta * w) / MIN_HFOV)
    if (!match || match.distinctiveness > MAX_DISTINCTIVENESS) continue
    estimates.push((delta * w) / match.shift)
  }
  const median = medianOf(estimates)
  const agreeing = median === null ? [] : estimates.filter((e) => Math.abs(e - median) <= median * AGREEMENT)
  const hfov = medianOf(agreeing)
  if (agreeing.length < MIN_AGREEING_PAIRS || hfov === null || hfov < MIN_HFOV || hfov > MAX_HFOV) {
    return { hfov: fallback, measured: false, pairs: agreeing.length }
  }
  return { hfov, measured: true, pairs: agreeing.length }
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((x, y) => x - y)
  return sorted[Math.floor(sorted.length / 2)]
}
