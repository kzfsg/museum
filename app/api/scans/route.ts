// GET /api/scans                  -> most recent saved scans
// GET /api/scans?lat=..&lng=..    -> saved scans near a point, newest first

import { listScanIndex, nearestEntries, readScan, scanImageUrl, scanStoreEnabled, type SavedScan } from '@/src/lib/scanStore'

export const runtime = 'nodejs'

const NEARBY_RADIUS_M = 60
const MAX_RESULTS = 20

export type ScanWithUrl = SavedScan & { imageUrl: string }

export async function GET(req: Request) {
  if (!scanStoreEnabled()) return Response.json({ scans: [] })

  const url = new URL(req.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const nearby = url.searchParams.has('lat') && Number.isFinite(lat) && Number.isFinite(lng)

  const index = await listScanIndex()
  // Newest first (ids start with a timestamp): for a spot scanned several
  // times, the latest scan is the one to show.
  const newestFirst = (a: { id: string }, b: { id: string }) => b.id.localeCompare(a.id)
  const entries = nearby ? nearestEntries(index, lat, lng, NEARBY_RADIUS_M).sort(newestFirst) : index.sort(newestFirst)

  const scans = await Promise.all(entries.slice(0, MAX_RESULTS).map((e) => readScan(e.pathname)))
  const result: ScanWithUrl[] = scans
    .filter((s): s is SavedScan => s !== null)
    .map((s) => ({ ...s, imageUrl: scanImageUrl(s.imagePath) }))
  return Response.json({ scans: result })
}
