import { describe, expect, it } from 'vitest'
import {
  allowedDistanceM,
  distanceToFootprintM,
  parseFootprints,
  parseWikidataYear,
  pickFootprint,
  pointInRing,
  type Footprint,
} from './building'

// A ~40 m square building around (40.8070, -73.9640).
const LAT = 40.807
const LNG = -73.964
const dLat = 20 / 111_320
const dLng = 20 / (111_320 * Math.cos((LAT * Math.PI) / 180))
const square: [number, number][] = [
  [LNG - dLng, LAT - dLat],
  [LNG + dLng, LAT - dLat],
  [LNG + dLng, LAT + dLat],
  [LNG - dLng, LAT + dLat],
  [LNG - dLng, LAT - dLat],
]
const hall: Footprint = { name: 'Hall', constructionYear: 1912, rings: [square] }
// A point `m` meters north of the building's north wall.
const northOf = (m: number) => LAT + dLat + m / 111_320

describe('footprint geometry', () => {
  it('knows when a point is inside', () => {
    expect(pointInRing(LNG, LAT, square)).toBe(true)
    expect(pointInRing(LNG, northOf(5), square)).toBe(false)
    expect(distanceToFootprintM(LAT, LNG, hall)).toBe(0)
  })
  it('measures distance to the nearest wall', () => {
    expect(distanceToFootprintM(northOf(10), LNG, hall)).toBeCloseTo(10, 0)
  })
})

describe('pickFootprint', () => {
  it('only counts a nearby building within the allowed distance', () => {
    expect(pickFootprint([hall], northOf(6), LNG, 20)?.footprint.name).toBe('Hall')
    expect(pickFootprint([hall], northOf(6), LNG, 5)).toBeNull()
    expect(pickFootprint([hall], LAT, LNG, 0)?.distanceM).toBe(0)
  })
})

describe('allowedDistanceM', () => {
  it('uses GPS accuracy, capped, and requires being inside without it', () => {
    expect(allowedDistanceM(null)).toBe(0)
    expect(allowedDistanceM(5)).toBe(5)
    expect(allowedDistanceM(65)).toBe(25)
  })
})

describe('parseFootprints', () => {
  it('reads MultiPolygon rows and cleans up fields', () => {
    const rows = [
      { name: ' Alfred Lerner Hall ', construction_year: '1912', the_geom: { type: 'MultiPolygon', coordinates: [[square]] } },
      { construction_year: '0', the_geom: { type: 'Polygon', coordinates: [square] } },
      { name: 'No geometry' },
    ]
    const parsed = parseFootprints(rows)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ name: 'Alfred Lerner Hall', constructionYear: 1912 })
    expect(parsed[1]).toMatchObject({ name: null, constructionYear: null })
    expect(parsed[0].rings[0]).toHaveLength(5)
  })
})

describe('parseWikidataYear', () => {
  it('reads the year from a Wikidata time', () => {
    expect(parseWikidataYear('+1999-00-00T00:00:00Z')).toBe(1999)
    expect(parseWikidataYear(undefined)).toBeNull()
  })
})
