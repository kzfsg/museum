import { describe, expect, it } from 'vitest'
import { geoFilter, scanDocument } from './mongoScans'
import type { SavedScan } from './scanStore'

const scan: SavedScan = { id: 'test', lat: 40.807, lng: -73.964, year: 1920, startYaw: 0, imagePath: 'scans/test.jpg', presentPath: 'scans/test.now.jpg', tidbits: [], createdAt: '2026-09-27T00:00:00Z' }

describe('MongoDB geographic storage', () => {
  it('stores longitude first and retains the images and history', () => {
    expect(scanDocument(scan)).toEqual({ ...scan, location: { type: 'Point', coordinates: [-73.964, 40.807] } })
  })
  it('rejects coordinates MongoDB cannot index', () => {
    for (const lat of [NaN, Infinity, 91]) expect(() => scanDocument({ ...scan, lat })).toThrow()
    expect(() => scanDocument({ ...scan, lng: -181 })).toThrow()
  })
  it('converts a meter radius to radians and accepts zero coordinates', () => {
    expect(geoFilter({ lat: 0, lng: 0, radiusM: 1000, limit: 20 })).toEqual({ location: { $geoWithin: { $centerSphere: [[0, 0], 1000 / 6378100] } } })
    expect(geoFilter({ limit: 20 })).toEqual({})
  })
})
