// Which building a scan was taken in (or right next to), and when it opened.
// Footprints come from NYC's building footprint dataset. Its construction
// years are unreliable for some campuses (Columbia's Alfred Lerner Hall is
// listed as 1912; it opened in 1999), so a named building's year comes from
// Wikidata when available, falling back to the city's year.

const FOOTPRINTS_URL = 'https://data.cityofnewyork.us/resource/5zhs-2jue.json'
const FETCH_TIMEOUT_MS = 6000
const USER_AGENT = 'TimeMachineDivHacks/0.1 (https://museum-six-lemon.vercel.app; DivHacks hackathon prototype)'

// GPS indoors often lands a little outside the building, so a nearby
// footprint can count as "the building you're in" -- but only within the
// phone's reported GPS accuracy (indoors that's typically 15 m+, outdoors ~5 m,
// so someone on the sidewalk next to a building isn't placed inside it), and
// never beyond this distance.
export const MAX_BUILDING_DISTANCE_M = 25

export function allowedDistanceM(accuracyM: number | null): number {
  return accuracyM !== null && accuracyM > 0 ? Math.min(MAX_BUILDING_DISTANCE_M, accuracyM) : 0
}

export interface Building {
  name: string | null
  openedYear: number
  yearSource: 'wikidata' | 'city'
  // 0 when the scan point is inside the footprint.
  distanceM: number
}

type Ring = [number, number][] // [lng, lat]

export interface Footprint {
  name: string | null
  constructionYear: number | null
  rings: Ring[]
}

const M_PER_DEG_LAT = 111_320

function toMeters(lat0: number): (p: [number, number]) => [number, number] {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180)
  return ([lng, lat]) => [lng * mPerDegLng, lat * M_PER_DEG_LAT]
}

export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// Distance in meters from a point to a footprint (0 if inside).
export function distanceToFootprintM(lat: number, lng: number, footprint: Footprint): number {
  if (footprint.rings.some((r) => pointInRing(lng, lat, r))) return 0
  const m = toMeters(lat)
  const [px, py] = m([lng, lat])
  let best = Infinity
  for (const ring of footprint.rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = m(ring[i])
      const [bx, by] = m(ring[i + 1])
      const dx = bx - ax
      const dy = by - ay
      const len2 = dx * dx + dy * dy
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
      best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    }
  }
  return best
}

// The footprint containing the point, else the nearest within `maxDistanceM`.
export function pickFootprint(
  footprints: Footprint[],
  lat: number,
  lng: number,
  maxDistanceM: number
): { footprint: Footprint; distanceM: number } | null {
  let best: { footprint: Footprint; distanceM: number } | null = null
  for (const footprint of footprints) {
    const distanceM = distanceToFootprintM(lat, lng, footprint)
    if (distanceM <= maxDistanceM && (!best || distanceM < best.distanceM)) best = { footprint, distanceM }
  }
  return best
}

interface FootprintRow {
  name?: string
  construction_year?: string
  the_geom?: { type: string; coordinates: number[][][][] | number[][][] }
}

export function parseFootprints(rows: unknown): Footprint[] {
  if (!Array.isArray(rows)) return []
  return (rows as FootprintRow[]).flatMap((row) => {
    const geom = row.the_geom
    if (!geom) return []
    const polygons = (geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]) as number[][][][]
    const rings = polygons.flatMap((polygon) => polygon.map((ring) => ring.map(([x, y]) => [x, y] as [number, number])))
    const year = Number.parseInt(row.construction_year ?? '', 10)
    return [{ name: row.name?.trim() || null, constructionYear: year >= 1600 ? year : null, rings }]
  })
}

// Year from a Wikidata time value like "+1999-00-00T00:00:00Z".
export function parseWikidataYear(time: unknown): number | null {
  const m = typeof time === 'string' ? /^\+?(\d{4})-/.exec(time) : null
  return m ? Number(m[1]) : null
}

async function fetchFootprints(lat: number, lng: number): Promise<Footprint[]> {
  const r = MAX_BUILDING_DISTANCE_M + 15
  const dLat = r / M_PER_DEG_LAT
  const dLng = r / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const box = `POLYGON((${lng - dLng} ${lat - dLat}, ${lng + dLng} ${lat - dLat}, ${lng + dLng} ${lat + dLat}, ${lng - dLng} ${lat + dLat}, ${lng - dLng} ${lat - dLat}))`
  const params = new URLSearchParams({
    $select: 'name,construction_year,the_geom',
    $where: `intersects(the_geom, '${box}')`,
    $limit: '50',
  })
  const res = await fetch(`${FOOTPRINTS_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Footprints ${res.status}`)
  return parseFootprints(await res.json())
}

// Official opening (P1619), else inception (P571), for the Wikipedia article
// with this exact title.
async function fetchOpeningYear(name: string): Promise<number | null> {
  const headers = { 'User-Agent': USER_AGENT }
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const wp = await fetch(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: 'query',
      titles: name,
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      redirects: '1',
      format: 'json',
      formatversion: '2',
    })}`,
    { headers, signal }
  )
  if (!wp.ok) return null
  const item = (await wp.json())?.query?.pages?.[0]?.pageprops?.wikibase_item as string | undefined
  if (!item) return null
  const wd = await fetch(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: item, props: 'claims', format: 'json' })}`,
    { headers, signal }
  )
  if (!wd.ok) return null
  const claims = (await wd.json())?.entities?.[item]?.claims ?? {}
  for (const property of ['P1619', 'P571']) {
    const year = parseWikidataYear(claims[property]?.[0]?.mainsnak?.datavalue?.value?.time)
    if (year) return year
  }
  return null
}

// Null when there's no building at the point or the lookup fails.
export async function findBuilding(lat: number, lng: number, accuracyM: number | null): Promise<Building | null> {
  try {
    const picked = pickFootprint(await fetchFootprints(lat, lng), lat, lng, allowedDistanceM(accuracyM))
    if (!picked) return null
    const { footprint, distanceM } = picked
    const wikidataYear = footprint.name ? await fetchOpeningYear(footprint.name).catch(() => null) : null
    if (wikidataYear) return { name: footprint.name, openedYear: wikidataYear, yearSource: 'wikidata', distanceM }
    if (footprint.constructionYear) return { name: footprint.name, openedYear: footprint.constructionYear, yearSource: 'city', distanceM }
    return null
  } catch (e) {
    console.error('Building lookup failed', e)
    return null
  }
}
