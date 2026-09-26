import { describe, expect, it } from 'vitest'
import { syncViews, type View, type ViewHandle } from './viewSync'

function fakeViewer(view: View): ViewHandle & { view: View } {
  return {
    view,
    getYaw: () => view.yaw,
    getPitch: () => view.pitch,
    getHfov: () => view.hfov,
    setYaw: (y) => void (view.yaw = y),
    setPitch: (p) => void (view.pitch = p),
    setHfov: (h) => void (view.hfov = h),
  }
}

describe('syncViews', () => {
  it('copies the first view onto the second on the first call', () => {
    const a = fakeViewer({ yaw: 30, pitch: 5, hfov: 60 })
    const b = fakeViewer({ yaw: 0, pitch: 0, hfov: 90 })
    expect(syncViews(a, b, null)).toEqual({ yaw: 30, pitch: 5, hfov: 60 })
    expect(b.view).toEqual({ yaw: 30, pitch: 5, hfov: 60 })
  })

  it('follows whichever view moved', () => {
    const a = fakeViewer({ yaw: 30, pitch: 5, hfov: 60 })
    const b = fakeViewer({ yaw: 30, pitch: 5, hfov: 60 })
    let last = syncViews(a, b, null)

    b.view.yaw = 50
    last = syncViews(a, b, last)
    expect(a.view.yaw).toBe(50)

    a.view.pitch = -10
    last = syncViews(a, b, last)
    expect(b.view.pitch).toBe(-10)
    expect(last).toEqual({ yaw: 50, pitch: -10, hfov: 60 })
  })

  it('treats yaw across the ±180 seam as a small move', () => {
    const a = fakeViewer({ yaw: 179.995, pitch: 0, hfov: 60 })
    const b = fakeViewer({ yaw: -179.995, pitch: 0, hfov: 60 })
    const last = { yaw: -179.995, pitch: 0, hfov: 60 }
    // 0.01° apart: not a move, so nothing is copied.
    expect(syncViews(a, b, last)).toBe(last)
    expect(b.view.yaw).toBe(-179.995)
  })

  it('does nothing when neither view moved', () => {
    const a = fakeViewer({ yaw: 10, pitch: 0, hfov: 60 })
    const b = fakeViewer({ yaw: 10, pitch: 0, hfov: 60 })
    const last = syncViews(a, b, null)
    expect(syncViews(a, b, last)).toBe(last)
  })
})
