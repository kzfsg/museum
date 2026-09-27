import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { generateHistoricalImage } from './imagePipeline'

let png: Buffer
beforeAll(async () => { png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ddd' } }).png().toBuffer() })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const input = () => ({ image: new Blob([new Uint8Array(png)], { type: 'image/png' }), mode: 'follow' as const, prompt: 'Gemini research + constraints', fallbackPrompt: 'Original grounded prompt' })
const geminiImage = () => Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] })
const openaiImage = () => Response.json({ data: [{ b64_json: png.toString('base64') }] })

describe('historical image provider fallback', () => {
  it('uses Gemini with the real scan and converts PNG to actual JPEG', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-secret')
    const fetch = vi.fn().mockResolvedValue(geminiImage()); vi.stubGlobal('fetch', fetch)
    const result = await generateHistoricalImage(input())
    expect(result.provider).toBe('gemini')
    expect(result.bytes[0]).toBe(0xff); expect(result.bytes[1]).toBe(0xd8)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).not.toContain('test-secret')
    expect(JSON.parse(options.body).contents[0].parts[1].inlineData.data).toBe(png.toString('base64'))
  })
  it('falls back after quota failure with the ORIGINAL prompt and scan', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test'); vi.stubEnv('OPENAI_API_KEY', 'test')
    const fetch = vi.fn().mockResolvedValueOnce(new Response('quota', { status: 429 })).mockResolvedValueOnce(openaiImage()); vi.stubGlobal('fetch', fetch)
    const result = await generateHistoricalImage(input())
    expect(result.attempts.map(a => [a.provider, a.status])).toEqual([['gemini', 'error'], ['openai', 'ok']])
    const [url, options] = fetch.mock.calls[1]
    expect(url).toContain('/images/edits')
    expect(options.body.get('prompt')).toBe('Original grounded prompt')
    expect(options.body.get('image').size).toBe(png.length)
  })
  it('falls back for a 200 response without an image or invalid image bytes', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test'); vi.stubEnv('OPENAI_API_KEY', 'test')
    for (const response of [Response.json({ candidates: [] }), Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW52YWxpZA==' } }] } }] })]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response).mockResolvedValueOnce(openaiImage()))
      expect((await generateHistoricalImage(input())).provider).toBe('openai')
    }
  })
  it('never sends the scan in site mode, including the OpenAI fallback', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test'); vi.stubEnv('OPENAI_API_KEY', 'test')
    const fetch = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(openaiImage()); vi.stubGlobal('fetch', fetch)
    await generateHistoricalImage({ ...input(), mode: 'site' })
    expect(JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts).toHaveLength(1)
    expect(fetch.mock.calls[1][0]).toContain('/images/generations')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).not.toHaveProperty('image')
  })
  it('legacy mode skips Gemini even with a key configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test'); vi.stubEnv('OPENAI_API_KEY', 'test'); vi.stubEnv('AI_PIPELINE', 'legacy')
    const fetch = vi.fn().mockResolvedValue(openaiImage()); vi.stubGlobal('fetch', fetch)
    expect((await generateHistoricalImage(input())).provider).toBe('openai')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('returns safe failure metadata when both providers fail', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test'); vi.stubEnv('OPENAI_API_KEY', 'test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret credential error')))
    await expect(generateHistoricalImage(input())).rejects.toMatchObject({ message: 'Image generation is unavailable. Please try again.', attempts: [{ status: 'error' }, { status: 'error' }] })
  })
})
