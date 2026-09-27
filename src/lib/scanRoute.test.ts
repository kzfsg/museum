import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./savedScanLibrary', () => ({ savedScanLibrary: vi.fn() }))
import { savedScanLibrary } from './savedScanLibrary'
import { GET } from '../../app/api/scans/route'

beforeEach(() => { vi.resetAllMocks(); vi.mocked(savedScanLibrary).mockResolvedValue({ scans: [], source: 'mongodb' }) })

describe('saved scan API', () => {
  it('rejects missing or invalid coordinates instead of querying around zero', async () => {
    for (const query of ['lat=40', 'lng=-73', 'lat=&lng=-73', 'lat=91&lng=0', 'lat=40&lng=NaN']) {
      expect((await GET(new Request(`http://localhost/api/scans?${query}`))).status).toBe(400)
    }
    expect(savedScanLibrary).not.toHaveBeenCalled()
  })
  it('bounds queries and exposes the actual metadata store', async () => {
    const response = await GET(new Request('http://localhost/api/scans?lat=0&lng=0&radius=9999&limit=9999'))
    expect(savedScanLibrary).toHaveBeenCalledWith({ lat: 0, lng: 0, radiusM: 2000, limit: 200 })
    expect(response.headers.get('X-Scan-Store')).toBe('mongodb')
    expect(await response.json()).toEqual({ scans: [], source: 'mongodb' })
  })
  it('returns a retryable error rather than an empty successful library on failure', async () => {
    vi.mocked(savedScanLibrary).mockRejectedValue(new Error('private connection detail'))
    const response = await GET(new Request('http://localhost/api/scans'))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('private connection detail')
  })
})
