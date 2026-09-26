import { describe, expect, it } from 'vitest'
import { canCapture, guide, isUsableFrame, type GuideInput } from './captureGuide'

const base: GuideInput = { hasSensor: true, speed: 10, pitch: 0, filled: 3, total: 12, turnedDeg: 90 }

describe('canCapture', () => {
  it('allows slow, level frames', () => {
    expect(canCapture({ speed: 30, pitch: 5 })).toBe(true)
  })
  it('rejects fast or tilted frames', () => {
    expect(canCapture({ speed: 60, pitch: 0 })).toBe(false)
    expect(canCapture({ speed: 10, pitch: -25 })).toBe(false)
  })
})

describe('guide', () => {
  it('tells the user to slow down first', () => {
    expect(guide({ ...base, speed: 80, pitch: 30 }).status).toBe('too-fast')
  })
  it('does not flicker between the capture limit and the warning', () => {
    expect(guide({ ...base, speed: 45 }).status).toBe('turning')
  })
  it('says which way to tilt', () => {
    expect(guide({ ...base, pitch: 25 }).message).toMatch(/Tilt down/)
    expect(guide({ ...base, pitch: -25 }).message).toMatch(/Tilt up/)
  })
  it('asks to fill gaps after a full turn', () => {
    expect(guide({ ...base, turnedDeg: 400 }).status).toBe('fill-gaps')
  })
  it('handles devices without sensors and finished scans', () => {
    expect(guide({ ...base, hasSensor: false }).status).toBe('no-sensor')
    expect(guide({ ...base, filled: 12 }).status).toBe('done')
  })
})

describe('isUsableFrame', () => {
  const frame = (v: number) => new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i % 4 === 3 ? 255 : v))
  it('rejects black startup frames', () => {
    expect(isUsableFrame(frame(0))).toBe(false)
    expect(isUsableFrame(frame(10))).toBe(false)
  })
  it('keeps dim but real frames', () => {
    expect(isUsableFrame(frame(30))).toBe(true)
  })
})
