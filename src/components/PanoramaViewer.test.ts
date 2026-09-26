import { describe, expect, it } from 'vitest'
import { fitHfov } from './PanoramaViewer'

describe('fitHfov', () => {
  it('zooms a 69-degree band on a portrait phone to about the camera view', () => {
    expect(fitHfov(68.6, 390, 844)).toBeCloseTo(35, 0)
  })
  it('allows a wide view in landscape', () => {
    expect(fitHfov(68.6, 844, 390)).toBeGreaterThan(100)
  })
})
