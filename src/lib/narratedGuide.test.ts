import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const legacy = vi.hoisted(() => ({ start: vi.fn(), tell: vi.fn(), close: vi.fn(), setMuted: vi.fn() }))
vi.mock('./liveGuide', () => ({ LiveGuide: class { start = legacy.start; tell = legacy.tell; close = legacy.close; setMuted = legacy.setMuted } }))
import { NarratedGuide } from './narratedGuide'
const scene = { name: 'Library', neighborhood: 'NYC', year: 1920, tidbits: [{ title: 'Library', body: 'Opened in 1897.', yaw: 0 }] }
const audio = { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), setAttribute: vi.fn(), removeAttribute: vi.fn(), src: '', muted: false }
const callbacks = { onStatus: vi.fn(), onCaption: vi.fn() }
const audioResponse = () => new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'audio/mpeg' } })
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('Audio', class { constructor() { return audio } })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('preferred narrated guide lifecycle', () => {
  it('starts the current live guide when narration is not configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ available: false })))
    const provider = vi.fn(); const guide = new NarratedGuide(callbacks, provider)
    await guide.start(scene)
    expect(legacy.start).toHaveBeenCalledExactlyOnceWith(scene)
    expect(provider).toHaveBeenCalledWith('openai')
    guide.tell('Look north', true)
    expect(legacy.tell).toHaveBeenCalledWith('Look north', true)
    guide.close(); expect(legacy.close).toHaveBeenCalledOnce()
  })
  it('plays a hotspot with captions and reuses its audio on repeat', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ available: true })).mockResolvedValueOnce(audioResponse()); vi.stubGlobal('fetch', fetch)
    const guide = new NarratedGuide(callbacks, vi.fn()); await guide.start(scene)
    guide.tell('Right in front of them: Library.', true)
    await vi.waitFor(() => expect(callbacks.onCaption).toHaveBeenCalledWith('Library. Opened in 1897.'))
    guide.tell('Right in front of them: Library.', true)
    await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(2))
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(legacy.start).not.toHaveBeenCalled()
    guide.close(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
  it('switches to the legacy guide once after an ElevenLabs failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ available: true })).mockResolvedValue(new Response('', { status: 502 })))
    const guide = new NarratedGuide(callbacks, vi.fn()); await guide.start(scene)
    guide.tell('Library', true)
    await vi.waitFor(() => expect(legacy.start).toHaveBeenCalledOnce())
    guide.tell('Library', true)
    expect(legacy.tell).toHaveBeenCalledOnce()
  })
  it('does not start microphone fallback after the user closes while connecting', async () => {
    let resolve!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>(r => { resolve = r })))
    const guide = new NarratedGuide(callbacks, vi.fn()); const pending = guide.start(scene)
    guide.close(); resolve(Response.json({ available: false })); await pending
    expect(legacy.start).not.toHaveBeenCalled()
  })
})
