import { describe, expect, it } from 'vitest'
import { LAYERS, LAYER_IDS, MAX_LAYERS, allowedLayers, fallbackMix, layerFits, sanitizeMix } from './soundscape'

const ids = (mix: { layers: { id: string }[] }) => mix.layers.map((l) => l.id)

describe('layerFits', () => {
  it('keeps sounds to the years they existed', () => {
    expect(layerFits('old-car', 1850, false)).toBe(false)
    expect(layerFits('old-car', 1925, false)).toBe(true)
    expect(layerFits('hooves', 1990, false)).toBe(false)
    expect(layerFits('traffic-modern', 1940, false)).toBe(false)
  })

  it('keeps indoor and outdoor sounds apart', () => {
    expect(layerFits('room-tone', 1920, false)).toBe(false)
    expect(layerFits('room-tone', 1920, true)).toBe(true)
    expect(layerFits('harbor', 1920, true)).toBe(false)
    expect(layerFits('crowd', 1920, true)).toBe(true)
  })

  it('treats present-day scans as the library’s last year', () => {
    expect(layerFits('traffic-modern', 2026, false)).toBe(true)
  })
})

describe('fallbackMix', () => {
  it('only uses sounds that fit, with a bed to fill the silence', () => {
    for (const year of [1650, 1790, 1850, 1900, 1920, 1950, 1980, 2026]) {
      for (const indoor of [false, true]) {
        const mix = fallbackMix(year, indoor)
        expect(mix.layers.length).toBeGreaterThan(0)
        expect(mix.layers.every((l) => layerFits(l.id, year, indoor))).toBe(true)
        expect(mix.layers.some((l) => LAYERS[l.id].kind === 'bed')).toBe(true)
        expect(mix.caption).not.toBe('')
      }
    }
  })
})

describe('sanitizeMix', () => {
  it('drops unknown, duplicate, and anachronistic layers and clamps volume', () => {
    const mix = sanitizeMix(
      {
        layers: [
          { id: 'hooves', volume: 3 },
          { id: 'hooves', volume: 0.2 },
          { id: 'old-car', volume: 0.5 },
          { id: 'laser-gun', volume: 0.5 },
          { id: 'crowd' },
        ],
        caption: 'hooves and a crowd',
      },
      1850
    )
    expect(mix.layers).toEqual([
      { id: 'hooves', volume: 1 },
      { id: 'crowd', volume: 0.5 },
    ])
    expect(mix.caption).toBe('hooves and a crowd')
  })

  it('adds the era’s beds when only accents were picked', () => {
    const mix = sanitizeMix({ layers: [{ id: 'church-bell', volume: 0.4 }] }, 1850)
    expect(ids(mix)).toContain('church-bell')
    expect(mix.layers.some((l) => LAYERS[l.id].kind === 'bed')).toBe(true)
  })

  it('falls back entirely on garbage', () => {
    expect(ids(sanitizeMix('nope', 1920))).toEqual(ids(fallbackMix(1920)))
    expect(ids(sanitizeMix(null, 1920))).toEqual(ids(fallbackMix(1920)))
  })

  it('caps the number of layers', () => {
    const mix = sanitizeMix({ layers: allowedLayers(1900, false).map((id) => ({ id, volume: 0.5 })) }, 1900)
    expect(mix.layers.length).toBe(MAX_LAYERS)
  })
})

describe('the library', () => {
  it('has a file for every layer', async () => {
    const { existsSync } = await import('node:fs')
    for (const id of LAYER_IDS) expect(existsSync(`public/sounds/${id}.mp3`), id).toBe(true)
  })
})
