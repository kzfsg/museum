import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./building', () => ({ findBuilding: vi.fn() }))
vi.mock('./history', () => ({ fetchHistory: vi.fn(), historyTidbits: vi.fn() }))
vi.mock('./moreTidbits', () => ({ topUpTidbits: vi.fn() }))
vi.mock('./researchPlan', () => ({ planResearch: vi.fn(), researchedPrompt: vi.fn(), withNarrations: vi.fn() }))
vi.mock('./imagePipeline', () => ({ generateHistoricalImage: vi.fn(), ImagePipelineError: class extends Error {} }))
vi.mock('./scanStore', () => ({ saveScan: vi.fn(), scanImageUrl: (s: string) => `/image/${s}`, scanStoreEnabled: vi.fn() }))
vi.mock('./trace', () => ({ newTraceId: () => 'test', parseCaptureInfo: () => null, saveTrace: vi.fn(), saveTraceInput: vi.fn(), saveTraceOutput: vi.fn(), tracePaths: () => ({ input: 'input.jpg', output: 'output.jpg' }) }))
import { POST } from '../../app/api/generate/route'
import { findBuilding } from './building'
import { fetchHistory, historyTidbits } from './history'
import { topUpTidbits } from './moreTidbits'
import { planResearch, researchedPrompt, withNarrations } from './researchPlan'
import { generateHistoricalImage } from './imagePipeline'
import { saveScan, scanStoreEnabled } from './scanStore'
import { saveTrace, saveTraceInput, saveTraceOutput } from './trace'
const tidbits = [{ id: 't', title: 'Library', body: 'Opened in 1897', kind: 'history' as const, yaw: 0, pitch: 0 }]
function request(lat = '40.8') {
  const body = new FormData(); body.set('image', new Blob(['scan'], { type: 'image/jpeg' }), 'scan.jpg'); body.set('lat', lat); body.set('lng', '-73.9'); body.set('year', '1920')
  return new Request('http://localhost/api/generate', { method: 'POST', body })
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('OPENAI_API_KEY', 'test'); vi.stubEnv('GEMINI_API_KEY', '')
  vi.mocked(saveTrace).mockResolvedValue(undefined)
  vi.mocked(saveTraceInput).mockResolvedValue(undefined)
  vi.mocked(saveTraceOutput).mockResolvedValue(undefined)
  vi.mocked(findBuilding).mockResolvedValue(null)
  vi.mocked(fetchHistory).mockResolvedValue({ articles: [], buildings: [] })
  vi.mocked(historyTidbits).mockReturnValue(tidbits)
  vi.mocked(topUpTidbits).mockResolvedValue(tidbits)
  vi.mocked(planResearch).mockResolvedValue({ provider: 'deterministic', status: 'disabled', plan: null })
  vi.mocked(researchedPrompt).mockImplementation(base => base)
  vi.mocked(withNarrations).mockImplementation(t => t)
  vi.mocked(generateHistoricalImage).mockResolvedValue({ provider: 'openai', model: 'gpt-image-1', prompt: 'actual prompt', attempts: [{ provider: 'openai', model: 'gpt-image-1', status: 'ok', elapsedMs: 1 }], bytes: new Uint8Array([255,216,255]) })
})
afterEach(() => { vi.unstubAllEnvs() })
describe('generation pipeline route integration', () => {
  it('preserves the existing response and reports the actual successful provider', async () => {
    const response = await POST(request()); expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imageUrl).toMatch(/^data:image\/jpeg;base64,/)
    expect(body.tidbits).toEqual(tidbits)
    expect(body.generation).toMatchObject({ imageProvider: 'openai', researchProvider: 'deterministic' })
  })
  it('persists provider and narration metadata with both images and the trace', async () => {
    vi.mocked(scanStoreEnabled).mockReturnValue(true)
    vi.mocked(saveScan).mockResolvedValue({ id: 'saved', imagePath: 'saved.jpg' } as Awaited<ReturnType<typeof saveScan>>)
    await POST(request())
    expect(saveScan).toHaveBeenCalledWith(expect.any(Blob), expect.objectContaining({ generation: expect.objectContaining({ imageProvider: 'openai' }) }), expect.any(Blob))
    expect(saveTrace).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'actual prompt', imageProvider: 'openai' }))
  })
  it('permits Gemini-only configuration', async () => {
    vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('GEMINI_API_KEY', 'test')
    expect((await POST(request())).status).toBe(200)
  })
  it('rejects invalid coordinates before doing research or generating', async () => {
    expect((await POST(request('91'))).status).toBe(400)
    expect(fetchHistory).not.toHaveBeenCalled(); expect(generateHistoricalImage).not.toHaveBeenCalled()
  })
  it('never pays for an image when historical research is empty', async () => {
    vi.mocked(historyTidbits).mockReturnValue([])
    expect((await POST(request())).status).toBe(502)
    expect(generateHistoricalImage).not.toHaveBeenCalled()
  })
})
