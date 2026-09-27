import { describe, expect, it } from 'vitest'
import { historyTidbits, parsePluto, parseWikipedia, type History } from './history'

const O = { lat: 40.8075, lng: -73.9626 }

function page(title: string, lat: number, lng: number, extract = `${title} is a place.`) {
  return { title, description: `About ${title}`, extract, coordinates: [{ lat, lon: lng }] }
}

describe('parseWikipedia', () => {
  it('keeps one article per shared coordinate, preferring the shortest title', () => {
    const json = {
      query: {
        pages: [
          page('Columbia University Graduate School of Arts and Sciences', 40.8079, -73.9626),
          page('Columbia University', 40.8079, -73.9626),
          page('Alma Mater (New York sculpture)', 40.80783333, -73.9621),
        ],
      },
    }
    const titles = parseWikipedia(json, O.lat, O.lng).map((a) => a.title)
    expect(titles).toContain('Columbia University')
    expect(titles).toContain('Alma Mater (New York sculpture)')
    expect(titles).not.toContain('Columbia University Graduate School of Arts and Sciences')
  })

  it('drops far-away articles, pages without coordinates, and empty text', () => {
    const json = {
      query: {
        pages: [
          page('Far away', O.lat + 0.01, O.lng), // ~1.1 km
          { title: 'No coords', extract: 'x' },
          { ...page('Empty', O.lat + 0.001, O.lng), extract: '', description: undefined },
          page('Near', O.lat + 0.001, O.lng),
        ],
      },
    }
    expect(parseWikipedia(json, O.lat, O.lng).map((a) => a.title)).toEqual(['Near'])
  })

  it('computes bearing and a Wikipedia URL', () => {
    const [a] = parseWikipedia({ query: { pages: [page('East Thing', O.lat, O.lng + 0.001)] } }, O.lat, O.lng)
    expect(a.bearing).toBeCloseTo(90, 0)
    expect(a.url).toBe('https://en.wikipedia.org/wiki/East_Thing')
  })

  it('tolerates malformed responses', () => {
    expect(parseWikipedia(null, O.lat, O.lng)).toEqual([])
    expect(parseWikipedia({ error: 'x' }, O.lat, O.lng)).toEqual([])
  })
})

describe('parsePluto', () => {
  const row = (address: string, yearbuilt: string, lat: number, lng: number) => ({
    address,
    yearbuilt,
    numfloors: '6.0000000',
    latitude: String(lat),
    longitude: String(lng),
  })

  it('keeps buildings between 12 m and 120 m with a real year, nearest first', () => {
    const rows = [
      row('FAR ST', '1920', O.lat + 0.002, O.lng), // ~222 m
      row('TOO CLOSE', '1920', O.lat + 0.00005, O.lng), // ~6 m
      row('UNKNOWN YEAR', '0', O.lat + 0.0005, O.lng),
      row('B MID', '1972', O.lat + 0.0008, O.lng), // ~89 m
      row('A NEAR', '1899', O.lat + 0.0003, O.lng), // ~33 m
    ]
    const buildings = parsePluto(rows, O.lat, O.lng)
    expect(buildings.map((b) => b.address)).toEqual(['A NEAR', 'B MID'])
    expect(buildings[0]).toMatchObject({ yearBuilt: 1899, floors: 6 })
  })

  it('returns nothing for non-array input', () => {
    expect(parsePluto({ error: true }, O.lat, O.lng)).toEqual([])
  })
})

describe('historyTidbits', () => {
  const history: History = {
    articles: [
      { title: 'South Thing', extract: 'Old.', distanceM: 100, bearing: 200, url: 'https://en.wikipedia.org/wiki/South_Thing' },
    ],
    buildings: [
      { address: '1 NEW ST', yearBuilt: 1990, distanceM: 40, bearing: 10 },
      { address: '2 OLD ST', yearBuilt: 1880, floors: 4, distanceM: 50, bearing: 90 },
      { address: '3 OLDER ST', yearBuilt: 1870, distanceM: 60, bearing: 95 },
    ],
  }

  it('turns articles and old buildings into tidbits at their bearing', () => {
    const tidbits = historyTidbits(history, 1920)
    expect(tidbits.map((t) => t.title)).toEqual(['South Thing', 'Standing since 1880', 'Standing since 1870'])
    expect(tidbits[0].yaw).toBe(-160) // bearing 200 in Pannellum's [-180, 180)
    expect(tidbits[1].body).toContain('2 Old St')
  })

  it('stacks markers that would overlap', () => {
    const [, first, second] = historyTidbits(history, 1920)
    expect(first.pitch).toBe(0)
    expect(second.pitch).toBe(8)
  })

  it('skips buildings that did not exist yet in the chosen year', () => {
    const titles = historyTidbits(history, 1875).map((t) => t.title)
    expect(titles).toEqual(['South Thing', 'Standing since 1870'])
  })

  it('uses only the two oldest buildings when there are plenty of articles', () => {
    const articles = Array.from({ length: 6 }, (_, i) => ({ ...history.articles[0], title: `A${i}`, bearing: i * 50 }))
    const tidbits = historyTidbits({ ...history, articles }, 1920)
    expect(tidbits.filter((t) => t.kind === 'local').map((t) => t.title)).toEqual(['Standing since 1880', 'Standing since 1870'])
  })

  it('uses more buildings when articles are scarce', () => {
    const buildings = Array.from({ length: 8 }, (_, i) => ({ address: `${i} ST`, yearBuilt: 1850 + i, distanceM: 50, bearing: i * 40 }))
    expect(historyTidbits({ articles: history.articles, buildings }, 1920)).toHaveLength(7)
  })
})
