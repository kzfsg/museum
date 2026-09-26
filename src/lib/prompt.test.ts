import { describe, expect, it } from 'vitest'
import { buildPrompt } from './prompt'
import type { History } from './history'

const history: History = {
  articles: [{ title: 'Alma Mater', description: 'Sculpture', extract: 'x', distanceM: 50, bearing: 0, url: '' }],
  buildings: [
    { address: 'A', yearBuilt: 1972, floors: 20, distanceM: 40, bearing: 90 },
    { address: 'B', yearBuilt: 1899, distanceM: 60, bearing: 270 },
  ],
}

describe('buildPrompt', () => {
  it('lists buildings that did not exist yet at their image position', () => {
    const prompt = buildPrompt(1920, history)
    expect(prompt).toMatch(/did not exist yet in 1920/)
    expect(prompt).toContain('- about 75% from the left edge, about 40 m away: built 1972, 20 floors')
  })

  it('lists buildings that were already standing', () => {
    const prompt = buildPrompt(1920, history)
    expect(prompt).toMatch(/already standing in 1920/)
    expect(prompt).toContain('- about 25% from the left edge, about 60 m away: built 1899')
  })

  it('treats a building finished in the target year as standing', () => {
    expect(buildPrompt(1972, history)).not.toMatch(/did not exist yet/)
  })

  it('includes nearby places as context', () => {
    expect(buildPrompt(1920, history)).toContain('- Alma Mater (Sculpture)')
  })

  it('falls back to a general instruction without building data', () => {
    const prompt = buildPrompt(1920, null)
    expect(prompt).toMatch(/replace any that look too modern for 1920/)
    expect(prompt).not.toMatch(/Nearby places/)
  })

  it('warns that present-day places may postdate the year', () => {
    expect(buildPrompt(1920, history)).toMatch(/Nearby places today.*may not have existed yet in 1920/)
  })
})
