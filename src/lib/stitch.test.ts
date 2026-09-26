import { describe, expect, it } from 'vitest'
import { bandExtent, frameVfov } from './stitch'

// Portrait 9:16 frame: vertical FOV ~68.6 degrees.
const image = { width: 640, height: 1138 }
const half = frameVfov(image) / 2

describe('bandExtent', () => {
  it('is the full frame height when every frame is level', () => {
    const { top, bottom } = bandExtent([{ pitch: 0, image }, { pitch: 0, image }])
    expect(top).toBeCloseTo(half, 5)
    expect(bottom).toBeCloseTo(-half, 5)
  })

  it('keeps only rows every frame covers when tilts differ', () => {
    const { top, bottom } = bandExtent([{ pitch: 8, image }, { pitch: -6, image }])
    expect(top).toBeCloseTo(half - 6, 5) // limited by the frame tilted down
    expect(bottom).toBeCloseTo(-half + 8, 5) // limited by the frame tilted up
  })

  it('falls back to the union when frames share no rows', () => {
    const { top, bottom } = bandExtent([{ pitch: 60, image }, { pitch: -60, image }])
    expect(top).toBeCloseTo(60 + half, 5)
    expect(bottom).toBeCloseTo(-60 - half, 5)
  })
})
