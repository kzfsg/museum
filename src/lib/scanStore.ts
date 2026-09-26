// Saved scans live in a private Vercel Blob store as an image plus a JSON
// sidecar. Location and year are encoded in the pathname so nearby scans can be
// found from a single list() call without reading every sidecar. That's fine
// at hackathon scale (list returns up to 1000 blobs per page).

import { get, list, put } from '@vercel/blob'
import type { Tidbit } from '@/src/data/places'
import { haversineKm } from '@/src/lib/geo'

export interface SavedScan {
  id: string
  lat: number
  lng: number
  year: number
  startYaw: number
  imagePath: string
  tidbits: Tidbit[]
  createdAt: string
}

export interface ScanIndexEntry {
  id: string
  lat: number
  lng: number
  year: number
  pathname: string
}

const PREFIX = 'scans/'
const PATH_RE = /^scans\/(-?\d+\.\d+)_(-?\d+\.\d+)_(\d{4})_([\w-]+)\.json$/

export function scanStoreEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

export function scanPathname(meta: { id: string; lat: number; lng: number; year: number }, ext: 'json' | 'jpg'): string {
  return `${PREFIX}${meta.lat.toFixed(5)}_${meta.lng.toFixed(5)}_${meta.year}_${meta.id}.${ext}`
}

export function parseScanPathname(pathname: string): ScanIndexEntry | null {
  const m = PATH_RE.exec(pathname)
  if (!m) return null
  return { lat: Number(m[1]), lng: Number(m[2]), year: Number(m[3]), id: m[4], pathname }
}

// Entries within `radiusM`, nearest first.
export function nearestEntries(entries: ScanIndexEntry[], lat: number, lng: number, radiusM: number): ScanIndexEntry[] {
  return entries
    .map((e) => ({ e, d: haversineKm(lat, lng, e.lat, e.lng) * 1000 }))
    .filter(({ d }) => d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .map(({ e }) => e)
}

// Images are private, so the browser loads them through our own route.
export function scanImageUrl(imagePath: string): string {
  return `/api/scans/image?path=${encodeURIComponent(imagePath)}`
}

export function isScanImagePath(path: string): boolean {
  return path.startsWith(PREFIX) && path.endsWith('.jpg') && !path.includes('..')
}

export async function saveScan(
  image: Blob,
  meta: Omit<SavedScan, 'id' | 'imagePath' | 'createdAt'>
): Promise<SavedScan> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const imagePath = scanPathname({ id, ...meta }, 'jpg')
  await put(imagePath, image, { access: 'private', contentType: 'image/jpeg' })
  const scan: SavedScan = { id, imagePath, createdAt: new Date().toISOString(), ...meta }
  await put(scanPathname(scan, 'json'), JSON.stringify(scan), { access: 'private', contentType: 'application/json' })
  return scan
}

export async function listScanIndex(): Promise<ScanIndexEntry[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  return blobs.map((b) => parseScanPathname(b.pathname)).filter((e): e is ScanIndexEntry => e !== null)
}

export async function readScan(pathname: string): Promise<SavedScan | null> {
  const result = await get(pathname, { access: 'private' })
  if (!result || result.statusCode !== 200) return null
  return (await new Response(result.stream).json()) as SavedScan
}
