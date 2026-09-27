import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./mongoScans', () => ({ mongoEnabled: vi.fn(), queryMongoScans: vi.fn() }))
vi.mock('./scanStore', () => ({ scanStoreEnabled: vi.fn(), listScanIndex: vi.fn(), nearestEntries: vi.fn(), readScan: vi.fn() }))
import { mongoEnabled, queryMongoScans } from './mongoScans'
import { listScanIndex, readScan, scanStoreEnabled } from './scanStore'
import { savedScanLibrary } from './savedScanLibrary'

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(scanStoreEnabled).mockReturnValue(true)
  vi.mocked(listScanIndex).mockResolvedValue([])
})

describe('saved scan lookup', () => {
  it('serves MongoDB metadata without reading Blob sidecars', async () => {
    vi.mocked(mongoEnabled).mockReturnValue(true)
    vi.mocked(queryMongoScans).mockResolvedValue([])
    expect(await savedScanLibrary({ limit: 20 })).toEqual({ scans: [], source: 'mongodb' })
    expect(listScanIndex).not.toHaveBeenCalled()
  })
  it('explicitly identifies a fallback when MongoDB is unavailable', async () => {
    vi.mocked(mongoEnabled).mockReturnValue(true)
    vi.mocked(queryMongoScans).mockRejectedValue(new Error('unavailable'))
    expect(await savedScanLibrary({ limit: 20 })).toEqual({ scans: [], source: 'blob-fallback' })
  })
  it('reports an outage when neither store can serve the request', async () => {
    vi.mocked(mongoEnabled).mockReturnValue(true)
    vi.mocked(queryMongoScans).mockRejectedValue(new Error('unavailable'))
    vi.mocked(scanStoreEnabled).mockReturnValue(false)
    await expect(savedScanLibrary({ limit: 20 })).rejects.toThrow('unavailable')
  })
  it('limits Blob sidecar reads and skips missing entries', async () => {
    vi.mocked(listScanIndex).mockResolvedValue([
      { id: '1', pathname: 'old', lat: 1, lng: 1, year: 1920 },
      { id: '2', pathname: 'new', lat: 1, lng: 1, year: 1920 },
    ])
    vi.mocked(readScan).mockResolvedValue(null)
    expect(await savedScanLibrary({ limit: 1 })).toEqual({ scans: [], source: 'blob' })
    expect(readScan).toHaveBeenCalledExactlyOnceWith('new')
  })
})
