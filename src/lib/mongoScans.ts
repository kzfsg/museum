import { MongoClient, type Collection } from 'mongodb'
import type { SavedScan } from './scanStore'

export type ScanDocument = SavedScan & {
  location: { type: 'Point'; coordinates: [number, number] }
}

export function mongoEnabled(): boolean {
  return Boolean(process.env.MONGODB_URI)
}

// Reuse the pool across requests and Next development hot reloads.
const cache = globalThis as typeof globalThis & {
  museumMongo?: Promise<Collection<ScanDocument>>
}

export function scanCollection(): Promise<Collection<ScanDocument>> {
  if (!cache.museumMongo) {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('MONGODB_URI is not configured')
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })
    cache.museumMongo = (async () => {
      try {
        await client.connect()
        const collection = client.db(process.env.MONGODB_DB || 'time_machine').collection<ScanDocument>('scans')
        await collection.createIndexes([
          { key: { id: 1 }, unique: true, name: 'scan_id' },
          { key: { location: '2dsphere' }, name: 'scan_location' },
          { key: { createdAt: -1, id: -1 }, name: 'scans_newest' },
        ])
        return collection
      } catch (error) {
        cache.museumMongo = undefined
        await client.close()
        throw error
      }
    })()
  }
  return cache.museumMongo
}

export function scanDocument(scan: SavedScan): ScanDocument {
  if (!Number.isFinite(scan.lat) || !Number.isFinite(scan.lng) || Math.abs(scan.lat) > 90 || Math.abs(scan.lng) > 180) {
    throw new Error('Invalid scan coordinates')
  }
  return { ...scan, location: { type: 'Point', coordinates: [scan.lng, scan.lat] } }
}

export async function indexScan(scan: SavedScan): Promise<void> {
  const document = scanDocument(scan)
  await (await scanCollection()).replaceOne({ id: scan.id }, document, { upsert: true })
}

export interface ScanQuery { lat?: number; lng?: number; radiusM?: number; limit: number }

export function geoFilter(query: ScanQuery) {
  if (query.lat === undefined || query.lng === undefined) return {}
  return { location: { $geoWithin: { $centerSphere: [[query.lng, query.lat], (query.radiusM ?? 60) / 6378100] } } }
}

export async function queryMongoScans(query: ScanQuery): Promise<SavedScan[]> {
  const collection = await scanCollection()
  return collection.find(geoFilter(query), { projection: { _id: 0, location: 0 } })
    .sort({ createdAt: -1, id: -1 }).limit(query.limit).toArray()
}
