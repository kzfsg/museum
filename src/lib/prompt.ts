import { bearingToImageFraction } from '@/src/lib/geo'
import type { Building } from '@/src/lib/building'
import type { History, NearbyBuilding } from '@/src/lib/history'

const MAX_BUILDINGS_PER_LIST = 8

function describe(b: NearbyBuilding): string {
  const pct = Math.round(bearingToImageFraction(b.bearing) * 100)
  const floors = b.floors ? `, ${b.floors} floors` : ''
  return `- about ${pct}% from the left edge, about ${Math.round(b.distanceM)} m away: built ${b.yearBuilt}${floors}`
}

function contextLines(year: number, history: History | null): string[] {
  const articles = history?.articles ?? []
  if (articles.length === 0) return []
  return [
    `Nearby places today, for context (some may not have existed yet in ${year}):`,
    ...articles.map((a) => `- ${a.title}${a.description ? ` (${a.description})` : ''}`),
  ]
}

// Follow mode: repaint the user's scan as the same place in `year`. The scan
// may be indoors or outdoors; the model is told to keep whichever it is.
export function buildPrompt(year: number, history: History | null): string {
  const lines = [
    'This is a rough 360-degree equirectangular panorama of a place in New York City, photographed today. It may be indoors or outdoors.',
    'It was stitched from phone photos, so it has seams, and the gray areas are missing parts of the view (such as ceiling, sky, floor, or ground).',
    `Recreate it as a realistic photograph of this exact place in ${year}. If it shows an interior, keep it the same interior; if it shows the outdoors, keep it outdoors.`,
    'Keep the layout, the positions of walls, windows, doors, streets, and sidewalks, and the camera viewpoint exactly the same.',
    `Replace modern furniture, technology, lighting, vehicles, signage, storefronts, clothing, and fixtures with what would have been there in ${year}.`,
  ]

  const built = history?.buildings ?? []
  const notYet = built.filter((b) => b.yearBuilt > year).slice(0, MAX_BUILDINGS_PER_LIST)
  const standing = built.filter((b) => b.yearBuilt <= year).slice(0, MAX_BUILDINGS_PER_LIST)

  if (notYet.length > 0) {
    lines.push(
      `If the view shows the outdoors: city records say these buildings did not exist yet in ${year}. At their positions, show what plausibly stood there then (older, lower buildings or open lots), not the modern structures:`,
      ...notYet.map(describe)
    )
  }
  if (standing.length > 0) {
    lines.push(
      `If the view shows the outdoors: these buildings were already standing in ${year}. Keep them in place, restored to their appearance at the time:`,
      ...standing.map(describe)
    )
  }
  if (built.length === 0) {
    lines.push(`If the view shows the outdoors, keep buildings in the same positions, but replace any that look too modern for ${year} with period-appropriate buildings.`)
  }

  lines.push(...contextLines(year, history))
  lines.push('Fill in the missing areas naturally, remove the seams, and keep it a seamless equirectangular panorama whose left and right edges connect.')
  return lines.join('\n')
}

// Site mode: the building the user is in didn't exist yet in `year`, so the
// scan can't be followed. Generate the site itself, outdoors, from scratch,
// with surrounding buildings placed by direction (north = image center, as in
// every panorama in the app).
export function buildSitePrompt(year: number, history: History | null, building: Building): string {
  const name = building.name ? `${building.name}, ` : ''
  const standing = (history?.buildings ?? []).filter((b) => b.yearBuilt <= year).slice(0, MAX_BUILDINGS_PER_LIST)
  const lines = [
    `A realistic 360-degree equirectangular panorama photograph taken outdoors at street level in New York City in ${year}.`,
    `It is taken on the site where ${name}a building that opened in ${building.openedYear}, stands today; in ${year} that building did not exist yet, so show what occupied this spot and its surroundings at the time.`,
    `Period-accurate details for ${year}: streets, sidewalks, vehicles, signage, clothing, and lighting.`,
    'The center of the image faces north; the left and right edges face south.',
  ]
  if (standing.length > 0) {
    lines.push(`City records say these nearby buildings were already standing in ${year}; show them at these positions:`, ...standing.map(describe))
  }
  lines.push(...contextLines(year, history))
  lines.push('Keep the horizon level across the middle, and make the left and right edges connect seamlessly.')
  return lines.join('\n')
}

// Site mode happens when the building the scan was taken in opened after the
// chosen year. Returns the note shown to the user, or null in follow mode.
export function siteNote(year: number, building: Building | null): string | null {
  if (!building || building.openedYear <= year) return null
  return `This building opened in ${building.openedYear}. Here's the site in ${year}.`
}
