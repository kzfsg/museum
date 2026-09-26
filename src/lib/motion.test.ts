import { describe, expect, it } from 'vitest'
import { angleDiff, headingFromEuler, toYawRange } from './motion'

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
