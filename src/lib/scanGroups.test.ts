import { describe, expect, it } from 'vitest'
import { groupScans } from './scanGroups'

const at = (id: string, lat: number, lng: number) => ({ id, lat, lng })
// ~1.1 m per 0.00001 degrees of latitude.
const LAT = 40.8071
const LNG = -73.9639

describe('groupScans', () => {
  it('puts scans a few meters apart under one dot, newest first', () => {
    const groups = groupScans([at('new', LAT, LNG), at('mid', LAT + 0.00005, LNG), at('old', LAT, LNG + 0.00005)])
    expect(groups).toHaveLength(1)
    expect(groups[0].scans.map((s) => s.id)).toEqual(['new', 'mid', 'old'])
    expect(groups[0]).toMatchObject({ lat: LAT, lng: LNG })
  })

  it('keeps scans on different blocks apart', () => {
    const groups = groupScans([at('here', LAT, LNG), at('block over', LAT + 0.001, LNG)]) // ~110 m
    expect(groups.map((g) => g.scans.map((s) => s.id))).toEqual([['here'], ['block over']])
  })

  it('handles no scans', () => {
    expect(groupScans([])).toEqual([])
  })
})
