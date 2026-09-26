// GET /api/scans                  -> most recent saved scans
// GET /api/scans?lat=..&lng=..    -> saved scans near a point, newest first
//   &radius=..                     -> how near, in meters (default 60, max 2000)

import { listScanIndex, nearestEntries, readScan, scanImageUrl, scanStoreEnabled, type SavedScan } from '@/src/lib/scanStore'
import { findScanTraceInput, listTraceBlobPaths } from '@/src/lib/trace'

export const runtime = 'nodejs'

const NEARBY_RADIUS_M = 60
const MAX_RADIUS_M = 2000
const MAX_RESULTS = 20

export type ScanWithUrl = SavedScan & { imageUrl: string; presentUrl?: string }

export async function GET(req: Request) {
  if (!scanStoreEnabled()) return Response.json({ scans: [] })

  const url = new URL(req.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const nearby = url.searchParams.has('lat') && Number.isFinite(lat) && Number.isFinite(lng)
  const requested = Number(url.searchParams.get('radius'))
  const radius = requested > 0 ? Math.min(MAX_RADIUS_M, requested) : NEARBY_RADIUS_M

  const index = await listScanIndex()
  // Newest first (ids start with a timestamp): for a spot scanned several
  // times, the latest scan is the one to show.
  const newestFirst = (a: { id: string }, b: { id: string }) => b.id.localeCompare(a.id)
  const entries = nearby ? nearestEntries(index, lat, lng, radius).sort(newestFirst) : index.sort(newestFirst)

  const read = await Promise.all(entries.slice(0, MAX_RESULTS).map((e) => readScan(e.pathname)))
  const scans = await withLegacyPresent(read.filter((s): s is SavedScan => s !== null))
  const result: ScanWithUrl[] = scans.map((s) => ({
    ...s,
    imageUrl: scanImageUrl(s.imagePath),
    presentUrl: s.presentPath && scanImageUrl(s.presentPath),
  }))
  return Response.json({ scans: result })
}

// Scans saved before they kept their own present-day panorama still have it
// as their generation trace's input, so the split view works for them too.
async function withLegacyPresent(scans: SavedScan[]): Promise<SavedScan[]> {
  if (scans.every((s) => s.presentPath)) return scans
  try {
    const tracePathnames = await listTraceBlobPaths()
    return await Promise.all(
      scans.map(async (s) => {
        if (s.presentPath) return s
        const presentPath = await findScanTraceInput(s.id, tracePathnames)
        return presentPath ? { ...s, presentPath } : s
      })
    )
  } catch (e) {
    // Without it, those scans just don't offer the split view.
    console.error('Legacy present lookup failed', e)
    return scans
  }
}
