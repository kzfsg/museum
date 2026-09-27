// GET /api/scans                  -> most recent saved scans
// GET /api/scans?lat=..&lng=..    -> saved scans near a point, newest first
//   &radius=..                     -> how near, in meters (default 60, max 2000)

import { scanImageUrl, type SavedScan } from '@/src/lib/scanStore'
import { savedScanLibrary } from '@/src/lib/savedScanLibrary'

export const runtime = 'nodejs'

const NEARBY_RADIUS_M = 60
const MAX_RADIUS_M = 2000
const MAX_RESULTS = 20

export type ScanWithUrl = SavedScan & { imageUrl: string; presentUrl?: string }

export async function GET(req: Request) {
  const url = new URL(req.url)
  const latText = url.searchParams.get('lat')
  const lngText = url.searchParams.get('lng')
  const lat = Number(latText)
  const lng = Number(lngText)
  const nearby = latText !== null || lngText !== null
  if (nearby && (!latText?.trim() || !lngText?.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    return Response.json({ error: 'Provide valid latitude and longitude.' }, { status: 400 })
  }
  const requested = Number(url.searchParams.get('radius'))
  const radius = requested > 0 ? Math.min(MAX_RADIUS_M, requested) : NEARBY_RADIUS_M

  const requestedLimit = Number(url.searchParams.get('limit'))
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 200) : MAX_RESULTS
  try {
    const { scans, source } = await savedScanLibrary({ ...(nearby ? { lat, lng, radiusM: radius } : {}), limit })
    const result: ScanWithUrl[] = scans.map((s) => ({ ...s, imageUrl: scanImageUrl(s.imagePath), presentUrl: s.presentPath && scanImageUrl(s.presentPath) }))
    return Response.json({ scans: result, source }, { headers: { 'X-Scan-Store': source, 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Could not load saved panoramas. Please try again.' }, { status: 503 })
  }
}
