// Makes sure every generation has at least MIN_TIDBITS to explore. Nearby
// Wikipedia articles and old buildings come first (src/lib/history.ts); when a
// block is quiet, or the scan has no location, the rest comes from a web
// search about the area in that year, and failing that from a fixed list of
// city milestones told relative to the year, which can't fail.

import type { Tidbit } from '@/src/data/places'
import { MIN_TIDBITS, stackOverlaps } from '@/src/lib/history'

const SEARCH_MODEL = process.env.OPENAI_TIDBIT_MODEL || 'gpt-5.5'
// Runs alongside the image generation, which takes longer than this.
const SEARCH_TIMEOUT_MS = 60_000

interface Extra {
  title: string
  body: string
  source?: string
}

interface Milestone {
  year: number
  title: string
  // Includes the year, e.g. "The Brooklyn Bridge opened in 1883, ..."
  text: string
  article: string
}

const MILESTONES: Milestone[] = [
  { year: 1625, title: 'New Amsterdam', text: 'The Dutch founded New Amsterdam at the southern tip of Manhattan in 1625.', article: 'New_Amsterdam' },
  { year: 1664, title: 'New York gets its name', text: 'The English took New Amsterdam in 1664 and renamed it New York.', article: 'New_Amsterdam' },
  { year: 1754, title: "King's College", text: "King's College, today's Columbia University, was founded in 1754.", article: 'Columbia_University' },
  { year: 1776, title: 'The Great Fire of 1776', text: 'A fire in 1776, early in the British occupation, burned much of lower Manhattan.', article: 'Great_Fire_of_New_York' },
  { year: 1789, title: 'A capital city', text: 'George Washington was inaugurated at Federal Hall on Wall Street in 1789, while New York was the nation’s capital.', article: 'Federal_Hall' },
  { year: 1792, title: 'Under a buttonwood tree', text: 'Brokers signed the Buttonwood Agreement on Wall Street in 1792, the start of the New York Stock Exchange.', article: 'Buttonwood_Agreement' },
  { year: 1811, title: 'The street grid', text: "The Commissioners' Plan of 1811 laid out Manhattan's grid of numbered streets and avenues.", article: "Commissioners'_Plan_of_1811" },
  { year: 1825, title: 'The Erie Canal', text: "The Erie Canal opened in 1825, linking the Great Lakes to New York's harbor and making it the country's busiest port.", article: 'Erie_Canal' },
  { year: 1835, title: 'The Great Fire of 1835', text: "A fire in 1835 destroyed much of the financial district around Wall Street.", article: 'Great_Fire_of_New_York_(1835)' },
  { year: 1842, title: 'Croton water', text: 'The Croton Aqueduct began bringing fresh water to the city in 1842.', article: 'Old_Croton_Aqueduct' },
  { year: 1858, title: 'Central Park', text: 'Central Park first opened to the public in 1858.', article: 'Central_Park' },
  { year: 1868, title: 'The first elevated railway', text: "New York's first elevated railway ran along Greenwich Street and Ninth Avenue from 1868.", article: 'IRT_Ninth_Avenue_Line' },
  { year: 1883, title: 'The Brooklyn Bridge', text: 'The Brooklyn Bridge opened in 1883, linking Manhattan and Brooklyn.', article: 'Brooklyn_Bridge' },
  { year: 1886, title: 'The Statue of Liberty', text: 'The Statue of Liberty was dedicated in New York Harbor in 1886.', article: 'Statue_of_Liberty' },
  { year: 1892, title: 'Ellis Island', text: 'Ellis Island opened as an immigration station in 1892; millions of newcomers passed through it.', article: 'Ellis_Island' },
  { year: 1898, title: 'Five boroughs, one city', text: 'In 1898 Manhattan, Brooklyn, Queens, the Bronx and Staten Island joined into one City of Greater New York.', article: 'City_of_Greater_New_York' },
  { year: 1904, title: 'The subway', text: "New York's first subway line opened in 1904.", article: 'Interborough_Rapid_Transit_Company' },
  { year: 1913, title: 'Grand Central Terminal', text: 'Grand Central Terminal opened in 1913.', article: 'Grand_Central_Terminal' },
  { year: 1929, title: 'The Crash', text: 'The stock market crashed on Wall Street in 1929, the start of the Great Depression.', article: 'Wall_Street_crash_of_1929' },
  { year: 1931, title: 'The Empire State Building', text: 'The Empire State Building opened in 1931, the tallest building in the world at the time.', article: 'Empire_State_Building' },
  { year: 1939, title: "The World's Fair", text: "The 1939 World's Fair opened in Flushing Meadows, Queens.", article: "1939_New_York_World's_Fair" },
  { year: 1952, title: 'The United Nations', text: 'The United Nations headquarters on the East River was completed in 1952.', article: 'Headquarters_of_the_United_Nations' },
  { year: 1964, title: 'The Verrazzano bridge', text: 'The Verrazzano-Narrows Bridge opened in 1964, linking Brooklyn and Staten Island.', article: 'Verrazzano-Narrows_Bridge' },
  { year: 1973, title: 'The Twin Towers', text: 'The World Trade Center opened in 1973.', article: 'World_Trade_Center_(1973–2001)' },
  { year: 1977, title: 'The blackout', text: 'A citywide blackout in 1977 left New York in the dark for about a day.', article: 'New_York_City_blackout_of_1977' },
]

function relative(eventYear: number, year: number): string {
  const n = Math.abs(year - eventYear)
  if (n === 0) return `That's this very year.`
  const years = n === 1 ? 'year' : 'years'
  return eventYear < year ? `By ${year}, that was ${n} ${years} ago.` : `In ${year}, that's still ${n} ${years} away.`
}

// The `n` milestones closest in time to `year`, skipping titles already used.
export function milestoneTidbits(year: number, n: number, taken: Set<string> = new Set()): Extra[] {
  return MILESTONES.filter((m) => !taken.has(m.title))
    .sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year) || a.year - b.year)
    .slice(0, n)
    .map((m) => ({
      title: m.title,
      body: `${m.text} ${relative(m.year, year)}`,
      source: `https://en.wikipedia.org/wiki/${encodeURIComponent(m.article)}`,
    }))
}

// Extras have no real direction, so each goes in the middle of the widest
// empty stretch of the panorama.
export function placeExtras(tidbits: Tidbit[], extras: Extra[], idPrefix: string): Tidbit[] {
  const placed = [...tidbits]
  extras.forEach((e, i) => {
    const yaws = placed.map((t) => ((t.yaw % 360) + 360) % 360).sort((a, b) => a - b)
    let yaw = 0
    if (yaws.length > 0) {
      let widest = -1
      yaws.forEach((y, j) => {
        const next = j + 1 < yaws.length ? yaws[j + 1] : yaws[0] + 360
        if (next - y > widest) {
          widest = next - y
          yaw = (y + widest / 2) % 360
        }
      })
    }
    placed.push({
      id: `${idPrefix}-${i}-${e.title}`,
      kind: 'history',
      title: e.title,
      body: e.body,
      pitch: 0,
      yaw: Math.round(yaw > 180 ? yaw - 360 : yaw),
      source: e.source,
    })
  })
  return placed
}

// The Responses API's text, from the raw REST response.
function outputText(json: unknown): string {
  const output = (json as { output?: { type: string; content?: { type: string; text?: string }[] }[] })?.output ?? []
  return output
    .filter((o) => o.type === 'message')
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('')
}

export function parseSearchTidbits(json: unknown): Extra[] {
  try {
    const parsed = JSON.parse(outputText(json)) as { tidbits?: Extra[] }
    return (parsed.tidbits ?? []).filter((t) => t.title?.trim() && t.body?.trim()).map((t) => ({
      title: t.title.trim(),
      // Models sometimes repeat the citation in the body anyway.
      body: t.body.replace(/\s*\(?Source:[\s\S]*$/i, '').trim(),
      source: t.source?.startsWith('https://') ? t.source : undefined,
    }))
  } catch {
    return []
  }
}

async function searchTidbits(apiKey: string, year: number, n: number, place: TopUpPlace, taken: string[]): Promise<Extra[]> {
  const where =
    place.lat !== null && place.lng !== null
      ? `the few blocks around latitude ${place.lat.toFixed(5)}, longitude ${place.lng.toFixed(5)} in New York City` +
        (place.nearby.length > 0 ? ` (nearby: ${place.nearby.join(', ')})` : '')
      : 'New York City'
  const input = [
    `Find ${n} short, surprising, true facts about ${where} around the year ${year}:`,
    'what stood there, who lived or worked there, what daily life, streets, transport or businesses were like, notable events.',
    `Search the web and only use facts you can source. Don't repeat these: ${taken.join('; ') || 'none'}.`,
    'Each: a title of at most 6 words, a body of 1-2 plain sentences (no links or citations in it), and the https URL of the source.',
  ].join(' ')
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    body: JSON.stringify({
      model: SEARCH_MODEL,
      tools: [{ type: 'web_search' }],
      // Default effort often runs past a minute; low answers in ~20 s.
      reasoning: { effort: 'low' },
      input,
      text: {
        format: {
          type: 'json_schema',
          name: 'tidbits',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['tidbits'],
            properties: {
              tidbits: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'body', 'source'],
                  properties: { title: { type: 'string' }, body: { type: 'string' }, source: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`Responses API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return parseSearchTidbits(await res.json()).slice(0, n)
}

export interface TopUpPlace {
  lat: number | null
  lng: number | null
  // Titles of nearby Wikipedia articles, to point the search at the right place.
  nearby: string[]
}

export async function topUpTidbits(tidbits: Tidbit[], year: number, place: TopUpPlace, apiKey: string): Promise<Tidbit[]> {
  let all = tidbits
  if (all.length >= MIN_TIDBITS) return all
  try {
    if (!apiKey) throw new Error('No search provider configured')
    const found = await searchTidbits(apiKey, year, MIN_TIDBITS - all.length, place, all.map((t) => t.title))
    all = placeExtras(all, found, 'web')
  } catch (e) {
    // The milestones below still fill the gap.
    console.error('Tidbit search failed', e)
  }
  if (all.length < MIN_TIDBITS) {
    all = placeExtras(all, milestoneTidbits(year, MIN_TIDBITS - all.length, new Set(all.map((t) => t.title))), 'milestone')
  }
  return stackOverlaps(all)
}
