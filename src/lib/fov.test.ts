import { describe, expect, it } from 'vitest'
import { coverHfov, defaultHfov, estimateHfov, matchPair, normalizeGray, type FovFrame } from './fov'

// A deterministic textured 360-degree world, 10 px per degree.
const WORLD_W = 3600
const WORLD_H = 1600
function makeWorld(seed = 7): Float32Array {
  let s = seed
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const world = new Float32Array(WORLD_W * WORLD_H)
  for (let k = 0; k < 900; k++) {
    const cx = rand() * WORLD_W
    const cy = rand() * WORLD_H
    const rw = 10 + rand() * 80
    const rh = 10 + rand() * 120
    const v = rand() * 2 - 1
    for (let y = Math.max(0, Math.floor(cy - rh)); y < Math.min(WORLD_H, cy + rh); y++) {
      for (let x = Math.floor(cx - rw); x < cx + rw; x++) world[y * WORLD_W + ((x % WORLD_W) + WORLD_W) % WORLD_W] += v
    }
  }
  return world
}

// A portrait frame (96x128 gray) seeing `hfov` degrees around `heading`.
function frameAt(world: Float32Array, heading: number, hfov: number, brightness = 0): FovFrame {
  const w = 96
  const h = 128
  const pxPerDeg = WORLD_W / 360
  const spanX = hfov * pxPerDeg
  const spanY = spanX * (h / w)
  const lum = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = Math.floor(heading * pxPerDeg - spanX / 2 + (x / w) * spanX)
      const wy = Math.floor(WORLD_H / 2 - spanY / 2 + (y / h) * spanY)
      lum[y * w + x] = world[wy * WORLD_W + ((wx % WORLD_W) + WORLD_W) % WORLD_W] + brightness
    }
  }
  return { heading, gray: normalizeGray(w, h, lum) }
}

describe('defaultHfov', () => {
  it('depends on the video aspect ratio in portrait', () => {
    expect(defaultHfov(720, 1280)).toBeCloseTo(43, 0) // 16:9
    expect(defaultHfov(960, 1280)).toBeCloseTo(55, 0) // 4:3
  })
})

describe('coverHfov', () => {
  it('narrows when a tall box crops the sides', () => {
    // A 16:9 portrait stream in a tall box: height fits, width is cropped.
    expect(coverHfov(43, 720, 1280, 390, 844)).toBeLessThan(43)
    // Same shape as the video: nothing cropped.
    expect(coverHfov(43, 720, 1280, 360, 640)).toBeCloseTo(43, 5)
  })

  it('keeps the full width when a wide box crops top and bottom', () => {
    // Portrait stream in a half-screen pane (wider than the video): width fits.
    expect(coverHfov(43, 720, 1280, 390, 420)).toBeCloseTo(43, 5)
  })

  it('narrows by the cropped fraction on the tangent plane', () => {
    // Box half as wide as the scaled video: tan(visible/2) = tan(60/2) / 2.
    const expected = (2 * Math.atan(Math.tan(Math.PI / 6) / 2) * 180) / Math.PI
    expect(coverHfov(60, 1000, 1000, 500, 1000)).toBeCloseTo(expected, 5)
  })
})

describe('matchPair', () => {
  it('finds the shift between two overlapping frames', () => {
    const world = makeWorld()
    const a = frameAt(world, 100, 60)
    const b = frameAt(world, 130, 60)
    // 30 degrees at 96 px / 60 degrees = 48 px.
    expect(matchPair(a.gray, b.gray, 10, 90)!.shift).toBeCloseTo(48, -0.5)
  })
})

describe('estimateHfov', () => {
  const world = makeWorld()
  const scan = (hfov: number, jitter = 0) =>
    Array.from({ length: 12 }, (_, i) => frameAt(world, i * 30 + (i % 3) * jitter, hfov, i * 0.3))

  it.each([42, 57, 70])('recovers a %i degree camera from a 12-frame scan', (hfov) => {
    const est = estimateHfov(scan(hfov), 42)
    expect(est.measured).toBe(true)
    expect(Math.abs(est.hfov - hfov)).toBeLessThan(3)
  })

  it('copes with uneven spacing between frames', () => {
    const est = estimateHfov(scan(57, 3), 42)
    expect(Math.abs(est.hfov - 57)).toBeLessThan(3)
  })

  it('falls back when frames have nothing in common', () => {
    const noise = Array.from({ length: 12 }, (_, i) => frameAt(makeWorld(i + 100), i * 30, 57))
    expect(estimateHfov(noise, 42)).toMatchObject({ hfov: 42, measured: false })
  })
})
