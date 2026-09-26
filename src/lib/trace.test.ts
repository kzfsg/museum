import { describe, expect, it } from 'vitest'
import { isTraceImagePath, parseCaptureInfo, traceCandidatesForScan, tracePaths } from './trace'

describe('trace paths', () => {
  it('keeps traces apart from scans', () => {
    expect(tracePaths('123-abc')).toEqual({
      json: 'traces/123-abc.json',
      input: 'traces/123-abc-input.jpg',
      output: 'traces/123-abc-output.jpg',
    })
  })

  it('only serves trace input/output images', () => {
    expect(isTraceImagePath('traces/123-abc-input.jpg')).toBe(true)
    expect(isTraceImagePath('traces/123-abc-output.jpg')).toBe(true)
    expect(isTraceImagePath('traces/123-abc.json')).toBe(false)
    expect(isTraceImagePath('traces/../scans/x-input.jpg')).toBe(false)
    expect(isTraceImagePath('scans/123-abc-input.jpg')).toBe(false)
  })
})

describe('parseCaptureInfo', () => {
  it('parses the client JSON and ignores junk', () => {
    expect(parseCaptureInfo('{"lensHfov":56}')).toEqual({ lensHfov: 56 })
    expect(parseCaptureInfo('not json')).toBeNull()
    expect(parseCaptureInfo(null)).toBeNull()
    expect(parseCaptureInfo('x'.repeat(30_000))).toBeNull()
  })
})

describe('traceCandidatesForScan', () => {
  it('keeps traces that started up to five minutes before the scan was saved, nearest first', () => {
    const scan = '1790450539327-b7537m'
    const ids = [
      '1790450488558-2gpzvn', // 51s before: the generation that saved it
      '1790450200000-early1', // 5m39s before: too early
      '1790450530000-close1', // 9s before
      '1790450600000-after1', // after the scan: can't have saved it
    ]
    expect(traceCandidatesForScan(scan, ids)).toEqual(['1790450530000-close1', '1790450488558-2gpzvn'])
  })
})
