import { listScanIndex, nearestEntries, readScan, scanStoreEnabled, type SavedScan } from './scanStore'
import { mongoEnabled, queryMongoScans, type ScanQuery } from './mongoScans'

export async function savedScanLibrary(query: ScanQuery): Promise<{
  scans: SavedScan[]; source: 'mongodb' | 'blob' | 'blob-fallback' | 'disabled'
}> {
  const useMongo = mongoEnabled()
  if (useMongo) {
    try {
      return { scans: await queryMongoScans(query), source: 'mongodb' }
    } catch {
      // Never log connection strings or driver errors that may contain credentials.
      console.warn('MongoDB scan lookup unavailable; using saved Blob sidecars.')
      if (!scanStoreEnabled()) throw new Error('Saved scans unavailable')
    }
  }
  if (!scanStoreEnabled()) return { scans: [], source: 'disabled' }
  const index = await listScanIndex()
  const entries = query.lat !== undefined && query.lng !== undefined
    ? nearestEntries(index, query.lat, query.lng, query.radiusM ?? 60)
    : index
  entries.sort((a, b) => b.id.localeCompare(a.id))
  const scans = await Promise.all(entries.slice(0, query.limit).map((entry) => readScan(entry.pathname)))
  return { scans: scans.filter((s): s is SavedScan => s !== null), source: useMongo ? 'blob-fallback' : 'blob' }
}
