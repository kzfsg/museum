import { bearingToImageFraction } from '@/src/lib/geo'
import type { History, NearbyBuilding } from '@/src/lib/history'

const MAX_BUILDINGS_PER_LIST = 8

function describe(b: NearbyBuilding): string {
  const pct = Math.round(bearingToImageFraction(b.bearing) * 100)
  const floors = b.floors ? `, ${b.floors} floors` : ''
  return `- about ${pct}% from the left edge, about ${Math.round(b.distanceM)} m away: built ${b.yearBuilt}${floors}`
}

export function buildPrompt(year: number, history: History | null): string {
  const lines = [
    'This is a rough 360-degree equirectangular panorama of a street in New York City, photographed today.',
    'It was stitched from phone photos, so it has seams, and the gray areas are missing sky and ground.',
    `Recreate it as a realistic photograph of this exact spot in ${year}.`,
    'Keep the street layout, sidewalks, and camera viewpoint exactly the same.',
    `Replace modern vehicles, signage, storefronts, clothing, and street furniture with what would have been there in ${year}.`,
  ]

  const built = history?.buildings ?? []
  const notYet = built.filter((b) => b.yearBuilt > year).slice(0, MAX_BUILDINGS_PER_LIST)
  const standing = built.filter((b) => b.yearBuilt <= year).slice(0, MAX_BUILDINGS_PER_LIST)

  if (notYet.length > 0) {
    lines.push(
      `City records say these buildings did not exist yet in ${year}. At their positions, show what plausibly stood there then (older, lower buildings or open lots), not the modern structures:`,
      ...notYet.map(describe)
    )
  }
  if (standing.length > 0) {
    lines.push(
      `These buildings were already standing in ${year}. Keep them in place, restored to their appearance at the time:`,
      ...standing.map(describe)
    )
  }
  if (built.length === 0) {
    lines.push(`Keep buildings in the same positions, but replace any that look too modern for ${year} with period-appropriate buildings.`)
  }

  const articles = history?.articles ?? []
  if (articles.length > 0) {
    lines.push(
      `Nearby places today, for context (some may not have existed yet in ${year}):`,
      ...articles.map((a) => `- ${a.title}${a.description ? ` (${a.description})` : ''}`)
    )
  }

  lines.push('Fill in the sky and ground naturally, remove the seams, and keep it a seamless equirectangular panorama whose left and right edges connect.')
  return lines.join('\n')
}
