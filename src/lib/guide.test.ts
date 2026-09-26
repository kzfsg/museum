import { describe, expect, it } from 'vitest'
import { compassWord, describeView, guideInstructions, newViewTracker, summarizeView, viewUpdate, type GuideScene } from './guide'

const scene: GuideScene = {
  name: 'Broadway & 116th',
  neighborhood: 'Morningside Heights',
  year: 1920,
  tidbits: [
    { title: 'Low Library', body: 'Completed in 1897.', yaw: 90, source: 'https://en.wikipedia.org/wiki/Low_Memorial_Library' },
    { title: 'Butler Library', body: 'Opened in 1934.', yaw: 110 },
    { title: 'The subway', body: 'The 116th St station opened in 1904.', yaw: -90 },
  ],
}

describe('compassWord', () => {
  it('names the nearest of eight directions, wrapping around', () => {
    expect(compassWord(0)).toBe('north')
    expect(compassWord(44)).toBe('northeast')
    expect(compassWord(-90)).toBe('west')
    expect(compassWord(350)).toBe('north')
    expect(compassWord(180)).toBe('south')
  })
})

describe('guideInstructions', () => {
  it('grounds the guide in the scene and its tidbits', () => {
    const text = guideInstructions(scene)
    expect(text).toContain('Broadway & 116th (Morningside Heights)')
    expect(text).toContain('in 1920')
    expect(text).toContain('Low Library (to the east): Completed in 1897.')
    expect(text).toContain('never invent')
  })

  it('says so when nothing is known', () => {
    expect(guideInstructions({ ...scene, tidbits: [] })).toContain('No local history was found')
  })
})

describe('summarizeView', () => {
  it('lists tidbits inside the field of view, nearest the center first', () => {
    expect(summarizeView(scene, 100, 60)).toEqual({ facing: 'east', inView: ['Low Library', 'Butler Library'], ahead: 'Low Library' })
  })

  it('has nothing ahead when landmarks are only near the edges', () => {
    expect(summarizeView(scene, 60, 110)).toEqual({ facing: 'northeast', inView: ['Low Library', 'Butler Library'], ahead: null })
  })

  it('handles the wrap at ±180', () => {
    expect(summarizeView(scene, 262, 40).ahead).toBe('The subway')
  })
})

describe('describeView', () => {
  it('says when no landmark is in view', () => {
    expect(describeView(summarizeView(scene, 0, 60))).toBe('The visitor is now facing north. None of the known landmarks are in view.')
  })
})

describe('viewUpdate', () => {
  it('narrates a new landmark ahead once, then only passes the view along', () => {
    const tracker = newViewTracker()
    const first = viewUpdate(tracker, scene, 92, 60)
    expect(first?.speak).toBe(true)
    expect(first?.text).toContain('Right in front of them: Low Library.')

    // Small turn, same landmark ahead: nothing to say.
    expect(viewUpdate(tracker, scene, 100, 60)).toBeNull()

    // Turn away, then back: the guide already covered it.
    expect(viewUpdate(tracker, scene, 0, 60)?.speak).toBe(false)
    expect(viewUpdate(tracker, scene, 90, 60)?.speak).toBe(false)
  })

  it('narrates a different landmark coming ahead even on a small turn', () => {
    const tracker = newViewTracker()
    viewUpdate(tracker, scene, 88, 60)
    const next = viewUpdate(tracker, scene, 112, 60)
    expect(next?.speak).toBe(true)
    expect(next?.text).toContain('Butler Library')
  })
})
