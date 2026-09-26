// Keeps two panorama viewers looking the same way (split "then / now" view).
// Whichever one moved since the last sync leads, so dragging either pane, or
// the phone steering one of them, carries the other along.

import { angleDiff } from '@/src/lib/motion'

export interface View {
  yaw: number
  pitch: number
  hfov: number
}

export interface ViewHandle {
  getYaw(): number
  getPitch(): number
  getHfov(): number
  setYaw(yaw: number, animated?: number | false): void
  setPitch(pitch: number, animated?: number | false): void
  setHfov(hfov: number, animated?: number | false): void
}

const EPSILON = 0.01

export function readView(v: ViewHandle): View {
  return { yaw: v.getYaw(), pitch: v.getPitch(), hfov: v.getHfov() }
}

function applyView(v: ViewHandle, view: View): void {
  v.setYaw(view.yaw, false)
  v.setPitch(view.pitch, false)
  v.setHfov(view.hfov, false)
}

function moved(a: View, b: View): boolean {
  return (
    Math.abs(angleDiff(a.yaw, b.yaw)) > EPSILON ||
    Math.abs(a.pitch - b.pitch) > EPSILON ||
    Math.abs(a.hfov - b.hfov) > EPSILON
  )
}

// One sync step; call every frame with the view it returned last time.
// On the first call `a` leads.
export function syncViews(a: ViewHandle, b: ViewHandle, last: View | null): View {
  const va = readView(a)
  const vb = readView(b)
  if (!last || moved(va, last)) {
    if (moved(va, vb)) applyView(b, va)
    return va
  }
  if (moved(vb, last)) {
    applyView(a, vb)
    return vb
  }
  return last
}
