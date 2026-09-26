import { describe, expect, it } from 'vitest'
import { isScanImagePath, nearestEntries, parseScanPathname, scanPathname, scanStoreEnabled } from './scanStore'

describe('scan pathnames', () => {
  it('round-trip location, year, and id (including negative longitudes)', () => {
    const meta = { id: '1727370000000-abc123', lat: 40.80751, lng: -73.96262, year: 1920 }
    const path = scanPathname(meta, 'json')
    expect(path).toBe('scans/40.80751_-73.96262_1920_1727370000000-abc123.json')
    expect(parseScanPathname(path)).toEqual({ ...meta, pathname: path })
  })

  it('puts the present-day panorama next to the generated image', () => {
    const meta = { id: '1727370000000-abc123', lat: 40.80751, lng: -73.96262, year: 1920 }
    const path = scanPathname(meta, 'now.jpg')
    expect(path).toBe('scans/40.80751_-73.96262_1920_1727370000000-abc123.now.jpg')
    expect(parseScanPathname(path)).toBeNull()
    expect(isScanImagePath(path)).toBe(true)
  })

  it('ignores anything that is not a scan sidecar', () => {
    expect(parseScanPathname('scans/40.80751_-73.96262_1920_x.jpg')).toBeNull()
    expect(parseScanPathname('other/40.80751_-73.96262_1920_x.json')).toBeNull()
    expect(parseScanPathname('scans/garbage.json')).toBeNull()
  })
})

describe('nearestEntries', () => {
  const at = (id: string, lat: number, lng: number) => ({ id, lat, lng, year: 1920, pathname: id })
  it('returns entries within the radius, nearest first', () => {
    const entries = [at('far', 40.8085, -73.9626), at('mid', 40.8078, -73.9626), at('near', 40.8076, -73.9626)]
    expect(nearestEntries(entries, 40.8075, -73.9626, 60).map((e) => e.id)).toEqual(['near', 'mid'])
  })
})

describe('isScanImagePath', () => {
  it('only allows scan images', () => {
    expect(isScanImagePath('scans/40.1_-73.1_1920_x.jpg')).toBe(true)
    expect(isScanImagePath('scans/40.1_-73.1_1920_x.json')).toBe(false)
    expect(isScanImagePath('scans/../secret.jpg')).toBe(false)
    expect(isScanImagePath('elsewhere/x.jpg')).toBe(false)
  })
})

describe('scanStoreEnabled', () => {
  it('accepts a read-write token or an OIDC store id', () => {
    const saved = { ...process.env }
    delete process.env.BLOB_READ_WRITE_TOKEN
    delete process.env.BLOB_STORE_ID
    expect(scanStoreEnabled()).toBe(false)
    process.env.BLOB_STORE_ID = 'store_x'
    expect(scanStoreEnabled()).toBe(true)
    delete process.env.BLOB_STORE_ID
    process.env.BLOB_READ_WRITE_TOKEN = 'tok'
    expect(scanStoreEnabled()).toBe(true)
    process.env = saved
  })
})
