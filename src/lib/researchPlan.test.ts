import { afterEach, describe, expect, it, vi } from 'vitest'
import { planResearch, researchedPrompt, validatePlan, withNarrations } from './researchPlan'
import type { History } from './history'
import type { Tidbit } from '../data/places'
const history: History = { articles: [{ title: 'Library', extract: 'Opened in 1897.', url: 'https://en.wikipedia.org/wiki/Library', bearing: 0, distanceM: 50 }], buildings: [{ address: '1 Broadway', yearBuilt: 1934, bearing: 90, distanceM: 25 }] }
const tidbits: Tidbit[] = [{ id: 'library', kind: 'history', title: 'Library', body: 'Opened in 1897.', yaw: 0, pitch: 0, source: history.articles[0].url }]
const plan = { visualNotes: [{ text: 'Keep the library.', evidenceIds: ['article-0'] }], narrations: [{ tidbitId: 'library', text: 'This library opened in 1897.' }] }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('grounded Gemini planning', () => {
  it('rejects invented evidence IDs and unmatched or duplicate hotspots', () => {
    expect(() => validatePlan({ ...plan, visualNotes: [{ text: 'Made up', evidenceIds: ['unknown'] }] }, history, tidbits)).toThrow()
    expect(() => validatePlan({ ...plan, narrations: [{ tidbitId: 'unknown', text: 'Story' }] }, history, tidbits)).toThrow()
    expect(() => validatePlan({ ...plan, narrations: [...plan.narrations, ...plan.narrations] }, history, tidbits)).toThrow()
  })
  it('preserves coordinates, sources, factual text and canonical prompt', () => {
    const [result] = withNarrations(tidbits, { provider: 'gemini', status: 'ok', plan })
    expect(result).toMatchObject(tidbits[0]); expect(result.narration).toBe(plan.narrations[0].text)
    expect(researchedPrompt('Keep buildings and projection.', plan)).toMatch(/Keep buildings and projection\.$/)
    expect(researchedPrompt('original', null)).toBe('original')
  })
  it('sends retrieved evidence and validates structured output', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test')
    const fetch = vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }] })); vi.stubGlobal('fetch', fetch)
    const result = await planResearch(1920, history, tidbits, 'follow')
    expect(result.status).toBe('ok')
    expect(fetch.mock.calls[0][1].body).toContain('1897')
    expect(fetch.mock.calls[0][1].body).toContain('1934')
  })
  it('keeps deterministic research on malformed output, timeout or absent configuration', async () => {
    vi.stubEnv('GEMINI_API_KEY', ''); vi.stubEnv('GOOGLE_API_KEY', '')
    expect((await planResearch(1920, history, tidbits, 'site')).status).toBe('disabled')
    vi.stubEnv('GEMINI_API_KEY', 'test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] })))
    expect((await planResearch(1920, history, tidbits, 'site')).status).toBe('fallback')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')))
    expect((await planResearch(1920, history, tidbits, 'site')).plan).toBeNull()
  })
})
