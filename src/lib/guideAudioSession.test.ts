import { afterEach, describe, expect, it, vi } from 'vitest'
import { beginGuideAudioSession } from './guideAudioSession'

afterEach(() => vi.unstubAllGlobals())

describe('guide audio session', () => {
  it('replaces playback-only mode and resets after capture ends', () => {
    const audioSession = { type: 'playback' }
    vi.stubGlobal('navigator', { audioSession })
    const release = beginGuideAudioSession()
    expect(audioSession.type).toBe('play-and-record')
    release()
    expect(audioSession.type).toBe('auto')
  })

  it('does not reset a newer tour during delayed cleanup', () => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', { audioSession })
    const oldRelease = beginGuideAudioSession()
    const newRelease = beginGuideAudioSession()
    oldRelease()
    expect(audioSession.type).toBe('play-and-record')
    newRelease()
    expect(audioSession.type).toBe('auto')
  })

  it('works when the optional API is unavailable', () => {
    vi.stubGlobal('navigator', {})
    expect(() => beginGuideAudioSession()()).not.toThrow()
  })

  it('does not block microphone access when the category setter fails', () => {
    vi.stubGlobal('navigator', { audioSession: { set type(_value: string) { throw new Error('unsupported') } } })
    expect(() => beginGuideAudioSession()()).not.toThrow()
  })
})
