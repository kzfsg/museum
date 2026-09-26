import { describe, expect, it } from 'vitest'
import { bearingDeg, bearingToImageFraction, haversineKm } from './geo'

const O = { lat: 40.8075, lng: -73.9626 }

describe('bearingDeg', () => {
  it('gives compass bearings for the four directions', () => {
    expect(bearingDeg(O.lat, O.lng, O.lat + 0.001, O.lng)).toBeCloseTo(0, 0)
    expect(bearingDeg(O.lat, O.lng, O.lat, O.lng + 0.001)).toBeCloseTo(90, 0)
    expect(bearingDeg(O.lat, O.lng, O.lat - 0.001, O.lng)).toBeCloseTo(180, 0)
    expect(bearingDeg(O.lat, O.lng, O.lat, O.lng - 0.001)).toBeCloseTo(270, 0)
  })
})

describe('haversineKm', () => {
  it('measures ~111 m per 0.001 degrees of latitude', () => {
    expect(haversineKm(O.lat, O.lng, O.lat + 0.001, O.lng) * 1000).toBeCloseTo(111, 0)
  })
})

describe('bearingToImageFraction', () => {
  it('puts north at the image center, matching the stitcher', () => {
    expect(bearingToImageFraction(0)).toBe(0.5)
    expect(bearingToImageFraction(90)).toBe(0.75)
    expect(bearingToImageFraction(180)).toBe(0)
    expect(bearingToImageFraction(270)).toBe(0.25)
  })
})
