import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Tidbit } from '@/src/data/places'
import { MIN_TIDBITS } from './history'
import { milestoneTidbits, parseSearchTidbits, placeExtras, topUpTidbits } from './moreTidbits'

const nowhere = { lat: null, lng: null, nearby: [] }

function tidbit(title: string, yaw: number): Tidbit {
  return { id: title, kind: 'history', title, body: '.', pitch: 0, yaw }
}

function responsesJson(tidbits: { title: string; body: string; source: string }[]) {
  return { output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ tidbits }) }] }] }
}

afterEach(() => vi.unstubAllGlobals())

describe('milestoneTidbits', () => {
  it('picks the milestones closest in time and tells them relative to the year', () => {
    const [first, second] = milestoneTidbits(1905, 2)
    expect(first.title).toBe('The subway')
    expect(first.body).toContain('By 1905, that was 1 year ago.')
    expect(second.title).toBe('Five boroughs, one city')
  })

  it('talks about the future for early years, and skips titles already used', () => {
    const extras = milestoneTidbits(1600, 3, new Set(['New Amsterdam']))
    expect(extras.map((e) => e.title)).not.toContain('New Amsterdam')
    expect(extras[0].body).toContain("In 1600, that's still 64 years away.")
  })
})

describe('placeExtras', () => {
  it('puts each extra in the widest empty stretch', () => {
    const placed = placeExtras([tidbit('a', 0), tidbit('b', 90)], [{ title: 'x', body: '.' }, { title: 'y', body: '.' }], 'm')
    expect(placed[2].yaw).toBe(-135) // middle of 90..360
    expect(placed[3].yaw).toBeCloseTo(158) // then middle of 90..225
  })

  it('starts at north when there is nothing yet', () => {
    expect(placeExtras([], [{ title: 'x', body: '.' }], 'm')[0].yaw).toBe(0)
  })
})

describe('parseSearchTidbits', () => {
  it('reads the structured output and drops blank or unsourced parts', () => {
    const extras = parseSearchTidbits(
      responsesJson([
        { title: 'A', body: 'B. Source: https://example.com', source: 'https://example.com' },
        { title: ' ', body: 'x', source: '' },
        { title: 'C', body: 'D.', source: 'not a url' },
      ])
    )
    expect(extras).toEqual([
      { title: 'A', body: 'B.', source: 'https://example.com' },
      { title: 'C', body: 'D.', source: undefined },
    ])
  })

  it('tolerates junk', () => {
    expect(parseSearchTidbits(null)).toEqual([])
    expect(parseSearchTidbits({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'nope' }] }] })).toEqual([])
  })
})

describe('topUpTidbits', () => {
  it('leaves enough tidbits alone', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const many = Array.from({ length: MIN_TIDBITS }, (_, i) => tidbit(`t${i}`, i * 40))
    expect(await topUpTidbits(many, 1920, nowhere, 'key')).toBe(many)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fills from the web search first', async () => {
    const found = Array.from({ length: 7 }, (_, i) => ({ title: `web ${i}`, body: '.', source: 'https://example.com' }))
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(responsesJson(found))))
    const tidbits = await topUpTidbits([tidbit('near', 10)], 1920, nowhere, 'key')
    expect(tidbits).toHaveLength(MIN_TIDBITS)
    expect(tidbits.filter((t) => t.title.startsWith('web'))).toHaveLength(MIN_TIDBITS - 1)
  })

  it('falls back to milestones when the search fails or comes up short', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await topUpTidbits([], 1920, nowhere, 'key')).toHaveLength(MIN_TIDBITS)

    vi.stubGlobal('fetch', vi.fn(async () => Response.json(responsesJson([{ title: 'one', body: '.', source: '' }]))))
    const tidbits = await topUpTidbits([], 1750, nowhere, 'key')
    expect(tidbits).toHaveLength(MIN_TIDBITS)
    expect(tidbits.map((t) => t.title)).toContain('one')
  })
})
