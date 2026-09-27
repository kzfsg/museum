import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/narration/route'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const request = (value: unknown) => new Request('http://localhost/api/narration', { method: 'POST', body: JSON.stringify(value) })
const input = { year: 1920, tidbit: { title: 'Library', body: 'Opened in 1897.', narration: 'This library opened in 1897.', narrationProvider: 'gemini' } }
function enable() { vi.stubEnv('ELEVENLABS_API_KEY', 'private-key'); vi.stubEnv('ELEVENLABS_VOICE_ID', 'test-voice') }
describe('ElevenLabs narration endpoint', () => {
  it('does not expose keys in configuration and signals legacy fallback', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', '')
    expect(await GET().json()).toEqual({ available: false })
    expect((await POST(request(input))).status).toBe(503)
  })
  it('voices the saved Gemini script and returns audio with true provenance', async () => {
    enable()
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'audio/mpeg' } })); vi.stubGlobal('fetch', fetch)
    const response = await POST(request(input))
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Voice-Provider')).toBe('elevenlabs')
    expect(JSON.parse(fetch.mock.calls[0][1].body).text).toContain(input.tidbit.narration)
    expect(fetch.mock.calls[0][0]).not.toContain('private-key')
  })
  it('bounds input before charging for TTS', async () => {
    enable(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect((await POST(request({ ...input, tidbit: { ...input.tidbit, narration: 'x'.repeat(651) } }))).status).toBe(400)
    expect((await POST(request({ data: 'x'.repeat(13000) }))).status).toBe(413)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('handles quota and empty-audio failures without returning provider error details', async () => {
    enable(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('secret-key', { status: 429 })))
    const response = await POST(request(input))
    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({ fallback: 'openai-live' })
  })
})
