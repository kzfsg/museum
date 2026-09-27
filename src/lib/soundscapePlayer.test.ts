import { describe, expect, it } from 'vitest'
import { loopableSlice } from './soundscapePlayer'

// Just enough of AudioBuffer for slicing.
function buffer(channels: Float32Array[], sampleRate = 100) {
  return {
    sampleRate,
    length: channels[0].length,
    numberOfChannels: channels.length,
    duration: channels[0].length / sampleRate,
    getChannelData: (ch: number) => channels[ch],
  } as unknown as AudioBuffer
}
const ctx = { createBuffer: (n: number, length: number, rate: number) => buffer(Array.from({ length: n }, () => new Float32Array(length)), rate) }

describe('loopableSlice', () => {
  it('mixes down to mono and keeps at most the requested length', () => {
    const left = new Float32Array(1000).fill(1)
    const right = new Float32Array(1000).fill(0)
    const out = loopableSlice(ctx, buffer([left, right]), 5)
    expect(out.numberOfChannels).toBe(1)
    expect(out.length).toBe(500)
    // Past the seam, it's the average of the channels.
    expect(out.getChannelData(0)[400]).toBeCloseTo(0.5)
  })

  it('blends the loop point so the end flows into the start', () => {
    // A ramp: without blending, the loop would jump from high back to low.
    const ramp = Float32Array.from({ length: 1000 }, (_, i) => i / 1000)
    const out = loopableSlice(ctx, buffer([ramp]), 5).getChannelData(0)
    const seam = 200
    // At the very start it's all the audio that follows the slice's end...
    expect(out[0]).toBeGreaterThan(out[seam])
    // ...and by the end of the seam it's back to the slice itself.
    expect(out[seam + 1] - out[seam]).toBeCloseTo(0.001)
  })

  it('handles recordings shorter than the requested length', () => {
    const out = loopableSlice(ctx, buffer([new Float32Array(300).fill(0.2)]), 60)
    expect(out.length).toBeLessThanOrEqual(300)
    expect(out.getChannelData(0).every((v) => Number.isFinite(v))).toBe(true)
  })
})
