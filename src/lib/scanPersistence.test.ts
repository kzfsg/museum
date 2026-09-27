import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@vercel/blob', () => ({ get: vi.fn(), list: vi.fn(), put: vi.fn() }))
vi.mock('./mongoScans', () => ({ indexScan: vi.fn(), mongoEnabled: vi.fn() }))
import { list, put } from '@vercel/blob'
import { indexScan, mongoEnabled } from './mongoScans'
import { listScanIndex, saveScan } from './scanStore'

beforeEach(() => { vi.resetAllMocks() })

describe('scan persistence', () => {
  const meta = { lat: 40.807, lng: -73.964, year: 1920, startYaw: 0, tidbits: [] }
  it('indexes the complete scan only after saving images and the recovery sidecar', async () => {
    vi.mocked(mongoEnabled).mockReturnValue(true)
    const scan = await saveScan(new Blob(['past']), meta, new Blob(['present']))
    expect(put).toHaveBeenCalledTimes(3)
    expect(indexScan).toHaveBeenCalledExactlyOnceWith(scan)
    expect(scan.presentPath).toMatch(/\.now\.jpg$/)
    expect(vi.mocked(indexScan).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(put).mock.invocationCallOrder[2])
  })
  it('keeps the durable scan usable if the MongoDB index write fails', async () => {
    vi.mocked(mongoEnabled).mockReturnValue(true)
    vi.mocked(indexScan).mockRejectedValue(new Error('unavailable'))
    await expect(saveScan(new Blob(['past']), meta)).resolves.toMatchObject(meta)
    expect(put).toHaveBeenCalledTimes(2)
  })
  it('does not publish an index record when image persistence fails', async () => {
    vi.mocked(mongoEnabled).mockReturnValue(true)
    vi.mocked(put).mockRejectedValue(new Error('unavailable'))
    await expect(saveScan(new Blob(['past']), meta)).rejects.toThrow()
    expect(indexScan).not.toHaveBeenCalled()
  })
  it('follows Blob pagination so imports do not silently stop at 1000 objects', async () => {
    vi.mocked(list)
      .mockResolvedValueOnce({ blobs: [{ pathname: 'scans/40.80700_-73.96400_1920_first.json' }], hasMore: true, cursor: 'page2' } as Awaited<ReturnType<typeof list>>)
      .mockResolvedValueOnce({ blobs: [{ pathname: 'scans/40.80700_-73.96400_1920_second.json' }], hasMore: false } as Awaited<ReturnType<typeof list>>)
    expect((await listScanIndex()).map((s) => s.id)).toEqual(['first', 'second'])
    expect(list).toHaveBeenLastCalledWith({ prefix: 'scans/', limit: 1000, cursor: 'page2' })
  })
})
