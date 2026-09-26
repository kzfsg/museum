import { describe, expect, it } from 'vitest'
import { angleDiff, circularMean, headingFromEuler, OrientationTracker, toYawRange } from './motion'

describe('headingFromEuler', () => {
  // Upright phone (beta 90). alpha grows counter-clockwise from north.
  it('reads north when upright and unrotated', () => {
    expect(headingFromEuler(0, 90, 0)).toBeCloseTo(0, 5)
  })
  it('reads west when rotated 90 degrees counter-clockwise', () => {
    expect(headingFromEuler(90, 90, 0)).toBeCloseTo(270, 5)
  })
  it('reads east when rotated 270 degrees counter-clockwise', () => {
    expect(headingFromEuler(270, 90, 0)).toBeCloseTo(90, 5)
  })
})

describe('angleDiff', () => {
  it('takes the short way around 0/360', () => {
    expect(angleDiff(10, 350)).toBe(20)
    expect(angleDiff(350, 10)).toBe(-20)
    expect(angleDiff(90, 90)).toBe(0)
  })
})

describe('toYawRange', () => {
  it('wraps into [-180, 180)', () => {
    expect(toYawRange(190)).toBe(-170)
    expect(toYawRange(-190)).toBe(170)
    expect(toYawRange(180)).toBe(-180)
    expect(toYawRange(45)).toBe(45)
    expect(toYawRange(720 + 30)).toBe(30)
  })
})

describe('OrientationTracker', () => {
  // Upright phone: heading from alpha is (360 - alpha) % 360.
  const upright = (alpha: number, t: number, extra: Partial<import('./motion').OrientationSample> = {}) => ({
    alpha,
    beta: 90,
    gamma: 0,
    absolute: false,
    t,
    ...extra,
  })

  it('reports relative headings when there is no compass', () => {
    const tracker = new OrientationTracker()
    expect(tracker.update(upright(0, 0))).toMatchObject({ heading: 0, absolute: false, pitch: 0 })
    expect(tracker.update(upright(270, 100))!.heading).toBeCloseTo(90, 5)
  })

  it('uses Android absolute events directly and ignores the relative ones after', () => {
    const tracker = new OrientationTracker()
    expect(tracker.update(upright(270, 0, { absolute: true }))).toMatchObject({ absolute: true })
    expect(tracker.update(upright(0, 10))).toBeNull()
  })

  it('anchors iOS gyro headings to the compass', () => {
    const tracker = new OrientationTracker()
    // Gyro says 0 but the compass says 120: heading snaps to 120 on the first reading.
    expect(tracker.update(upright(0, 0, { compass: 120 }))!.heading).toBeCloseTo(120, 5)
    // Turning 90 degrees right follows the gyro immediately, even though the
    // lagging compass still reads 120.
    const r = tracker.update(upright(270, 1000, { compass: 120 }))!
    expect(r.heading).toBeCloseTo(210, 0)
    expect(r.absolute).toBe(true)
  })

  it('does not let a lagging compass drag the heading during a fast turn', () => {
    const tracker = new OrientationTracker()
    tracker.update(upright(0, 0, { compass: 0 }))
    // Spin 60 degrees in 0.1 s (600 deg/s) while the compass is stuck at 0.
    let r = tracker.update(upright(300, 100, { compass: 0 }))!
    for (let t = 120; t <= 300; t += 20) r = tracker.update(upright(300, t, { compass: 0 }))!
    expect(r.heading).toBeGreaterThan(55)
  })

  it('slowly corrects gyro drift toward the compass while still', () => {
    const tracker = new OrientationTracker()
    tracker.update(upright(0, 0, { compass: 0 }))
    let r = tracker.update(upright(0, 20, { compass: 10 }))!
    for (let t = 40; t <= 4000; t += 20) r = tracker.update(upright(0, t, { compass: 10 }))!
    expect(r.heading).toBeCloseTo(10, 0)
  })

  it('measures turning speed in degrees per second', () => {
    const tracker = new OrientationTracker()
    let r = tracker.update(upright(0, 0))!
    for (let i = 1; i <= 30; i++) r = tracker.update(upright(360 - i * 2, i * 20))! // 2 deg per 20 ms
    expect(r.speed).toBeCloseTo(100, 0)
  })

  it('skips a compass that reports itself invalid', () => {
    const tracker = new OrientationTracker()
    expect(tracker.update(upright(0, 0, { compass: -1 }))).toMatchObject({ absolute: false })
  })
})

describe('circularMean', () => {
  it('averages across the 0/360 wrap', () => {
    expect(circularMean([350, 10])).toBeCloseTo(0, 5)
    expect(circularMean([80, 100])).toBeCloseTo(90, 5)
    expect(circularMean([])).toBeNull()
  })
})

describe('OrientationTracker rawHeading', () => {
  it('stays gyro-only while the compass correction moves north', () => {
    const tracker = new OrientationTracker()
    const s = (t: number, compass: number) => ({ alpha: 0, beta: 90, gamma: 0, absolute: false, t, compass })
    tracker.update(s(0, 0))
    let r = tracker.update(s(20, 30))!
    for (let t = 40; t <= 4000; t += 20) r = tracker.update(s(t, 30))!
    expect(r.heading).toBeCloseTo(30, 0)
    expect(r.rawHeading).toBeCloseTo(0, 5)
  })
})
