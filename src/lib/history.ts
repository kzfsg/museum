// What's around a scan location: Wikipedia articles with coordinates, and the
// construction years of nearby buildings from NYC's PLUTO tax-lot dataset.

import type { Tidbit } from '@/src/data/places'
import { bearingDeg, haversineKm } from '@/src/lib/geo'

export interface NearbyArticle {
  title: string
  description?: string
  extract: string
  distanceM: number
  bearing: number
  url: string
}

export interface NearbyBuilding {
  address: string
  yearBuilt: number
  floors?: number
  distanceM: number
  bearing: number
}

export interface History {
  articles: NearbyArticle[]
  buildings: NearbyBuilding[]
}

const ARTICLE_RADIUS_M = 400
const MAX_ARTICLES = 5
export const BUILDING_RADIUS_M = 120
// Lot centroids closer than this are "the building you're standing at", whose
// bearing is too unstable to place.
const MIN_BUILDING_DISTANCE_M = 12
const MAX_BUILDING_TIDBITS = 2
const FETCH_TIMEOUT_MS = 6000
// Wikimedia's API policy requires contact info in the User-Agent and rejects
// generic agents, especially from cloud IPs like Vercel's.
const USER_AGENT = 'TimeMachineDivHacks/0.1 (https://museum-six-lemon.vercel.app; DivHacks hackathon prototype)'

interface WikiPage {
  title: string
  description?: string
  extract?: string
  coordinates?: { lat: number; lon: number }[]
}

export function parseWikipedia(json: unknown, lat: number, lng: number): NearbyArticle[] {
  const pages = ((json as { query?: { pages?: WikiPage[] } })?.query?.pages ?? []).filter((p) => p.coordinates?.[0])
  const articles = pages
    .map((p) => {
      const c = p.coordinates![0]
      return {
        page: p,
        coordKey: `${c.lat},${c.lon}`,
        article: {
          title: p.title,
          description: p.description,
          extract: p.extract?.trim() || p.description || '',
          distanceM: haversineKm(lat, lng, c.lat, c.lon) * 1000,
          bearing: bearingDeg(lat, lng, c.lat, c.lon),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replaceAll(' ', '_'))}`,
        },
      }
    })
    .filter(({ article }) => article.distanceM <= ARTICLE_RADIUS_M && article.extract)
    // Shorter titles first so that, among articles sharing one coordinate, the
    // general one ("Columbia University") wins over its departments and events.
    .sort((a, b) => a.article.distanceM - b.article.distanceM || a.page.title.length - b.page.title.length)

  // Many articles about an institution are pinned to the institution's single
  // coordinate; keep only one per exact coordinate.
  const seen = new Set<string>()
  const result: NearbyArticle[] = []
  for (const { coordKey, article } of articles) {
    if (seen.has(coordKey)) continue
    seen.add(coordKey)
    result.push(article)
    if (result.length === MAX_ARTICLES) break
  }
  return result
}

interface PlutoRow {
  address?: string
  yearbuilt?: string
  numfloors?: string
  latitude?: string
  longitude?: string
}

export function parsePluto(rows: unknown, lat: number, lng: number): NearbyBuilding[] {
  if (!Array.isArray(rows)) return []
  return (rows as PlutoRow[])
    .map((r): NearbyBuilding | null => {
      const yearBuilt = Number.parseInt(r.yearbuilt ?? '', 10)
      const bLat = Number(r.latitude)
      const bLng = Number(r.longitude)
      if (!r.address || !Number.isFinite(bLat) || !Number.isFinite(bLng) || !(yearBuilt >= 1600)) return null
      const floors = Number(r.numfloors)
      return {
        address: r.address,
        yearBuilt,
        floors: floors > 0 ? Math.round(floors) : undefined,
        distanceM: haversineKm(lat, lng, bLat, bLng) * 1000,
        bearing: bearingDeg(lat, lng, bLat, bLng),
      }
    })
    .filter((b): b is NearbyBuilding => b !== null && b.distanceM >= MIN_BUILDING_DISTANCE_M && b.distanceM <= BUILDING_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM)
}

function toYaw(bearing: number): number {
  return bearing > 180 ? bearing - 360 : bearing
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// Tidbits sit at their real compass direction (panorama yaw == bearing).
// Building tidbits only use buildings already standing in `year`, since the
// others aren't in the picture. Markers that would overlap are stacked upwards.
export function historyTidbits(history: History, year: number): Tidbit[] {
  const fromArticles: Tidbit[] = history.articles.map((a) => ({
    id: `wiki-${a.title}`,
    kind: 'history',
    title: a.title,
    body: a.extract,
    pitch: 0,
    yaw: toYaw(a.bearing),
    source: a.url,
  }))
  const oldest = history.buildings
    .filter((b) => b.yearBuilt <= year)
    .sort((a, b) => a.yearBuilt - b.yearBuilt).slice(0, MAX_BUILDING_TIDBITS)
  const fromBuildings: Tidbit[] = oldest.map((b) => ({
    id: `bldg-${b.address}`,
    kind: 'local',
    title: `Standing since ${b.yearBuilt}`,
    body: `City records list ${titleCase(b.address)} as built in ${b.yearBuilt}${b.floors ? `, ${b.floors} floors` : ''}. It's one of the oldest buildings around you.`,
    pitch: 0,
    yaw: toYaw(b.bearing),
    source: 'NYC Department of City Planning, PLUTO',
  }))

  const tidbits = [...fromArticles, ...fromBuildings].sort((a, b) => a.yaw - b.yaw)
  for (let i = 1; i < tidbits.length; i++) {
    if (Math.abs(tidbits[i].yaw - tidbits[i - 1].yaw) < 10) tidbits[i].pitch = tidbits[i - 1].pitch + 8
  }
  return tidbits
}

async function fetchWikipedia(lat: number, lng: number): Promise<NearbyArticle[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: String(ARTICLE_RADIUS_M),
    ggslimit: '20',
    prop: 'coordinates|description|extracts',
    exintro: '1',
    explaintext: '1',
    // A character cap, not `exsentences`: sentence splitting breaks on
    // abbreviations like "St." and cuts tidbits mid-name.
    exchars: '320',
    exlimit: '20',
    // `coordinates` pages at 10 by default, silently dropping the rest.
    colimit: 'max',
    format: 'json',
    formatversion: '2',
  })
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Wikipedia ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return parseWikipedia(await res.json(), lat, lng)
}

async function fetchPluto(lat: number, lng: number): Promise<NearbyBuilding[]> {
  const dLat = BUILDING_RADIUS_M / 111_320
  const dLng = BUILDING_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180))
  const params = new URLSearchParams({
    $select: 'address,yearbuilt,numfloors,latitude,longitude',
    $where: `latitude between ${lat - dLat} and ${lat + dLat} and longitude between ${lng - dLng} and ${lng + dLng}`,
    $limit: '300',
  })
  const res = await fetch(`https://data.cityofnewyork.us/resource/64uk-42ks.json?${params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`PLUTO ${res.status}`)
  return parsePluto(await res.json(), lat, lng)
}

// Either source failing (or timing out) just leaves that part empty.
export async function fetchHistory(lat: number, lng: number): Promise<History> {
  const [articles, buildings] = await Promise.allSettled([fetchWikipedia(lat, lng), fetchPluto(lat, lng)])
  // Failures are tolerated but logged, so they show up in the function logs.
  if (articles.status === 'rejected') console.error('History: Wikipedia lookup failed', articles.reason)
  if (buildings.status === 'rejected') console.error('History: PLUTO lookup failed', buildings.reason)
  return {
    articles: articles.status === 'fulfilled' ? articles.value : [],
    buildings: buildings.status === 'fulfilled' ? buildings.value : [],
  }
}
