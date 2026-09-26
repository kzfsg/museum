import { describe, expect, it } from 'vitest'
import { chooseHfov, fitHfov } from './PanoramaViewer'

describe('fitHfov', () => {
  it('zooms a 69-degree band on a portrait phone to about the camera view', () => {
    expect(fitHfov(68.6, 390, 844)).toBeCloseTo(35, 0)
  })
  it('allows a wide view in landscape', () => {
    expect(fitHfov(68.6, 844, 390)).toBeGreaterThan(100)
  })
})

describe('chooseHfov', () => {
  it('uses the preferred zoom when the band is tall enough', () => {
    expect(chooseHfov({ vaov: 105, width: 390, height: 844, preferred: 38 }).hfov).toBe(38)
  })
  it('zooms in only as far as needed to hide the band edges', () => {
    const { hfov } = chooseHfov({ vaov: 60, width: 390, height: 844, preferred: 38 })
    expect(hfov).toBeCloseTo(fitHfov(60, 390, 844), 5)
  })
  it('keeps full panoramas at the preferred zoom', () => {
    expect(chooseHfov({ vaov: 180, width: 390, height: 844, preferred: 38 })).toMatchObject({ hfov: 38, maxHfov: 90 })
  })
})
