// Rough panorama stitch: each captured frame is pasted onto an equirectangular
// canvas at its compass heading. No feature matching; the AI pass hides seams.

export interface CapturedFrame {
  heading: number
  // Degrees above the horizon the camera pointed when the frame was taken.
  pitch: number
  image: HTMLCanvasElement
}

import { defaultHfov, estimateHfov, normalizeGray, type Gray } from '@/src/lib/fov'

// Typical portrait horizontal FOV of a phone camera with a 16:9 stream. Only
// used for sizing the viewer; stitching uses the FOV measured from the scan.
export const CAMERA_HFOV_DEG = 42

// Gaps are filled with neutral gray so the model reads them as "missing".
const GAP_COLOR = '#808080'

export function frameVfov(image: { width: number; height: number }, hfov: number): number {
  return (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) * (image.height / image.width)) * 180) / Math.PI
}

const GRAY_WIDTH = 96

function grayFromCanvas(image: HTMLCanvasElement): Gray {
  const w = GRAY_WIDTH
  const h = Math.round((GRAY_WIDTH * image.height) / image.width)
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const lum = new Float32Array(w * h)
  for (let i = 0; i < lum.length; i++) lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  return normalizeGray(w, h, lum)
}

// The camera's horizontal FOV for this scan: measured from how neighbouring
// frames overlap, or derived from the frame shape if that isn't reliable.
export function scanHfov(frames: CapturedFrame[]): { hfov: number; measured: boolean } {
  const fallback = frames[0] ? defaultHfov(frames[0].image.width, frames[0].image.height) : CAMERA_HFOV_DEG
  if (frames.length < 4) return { hfov: fallback, measured: false }
  const { hfov, measured } = estimateHfov(
    frames.map((f) => ({ heading: f.heading, gray: grayFromCanvas(f.image) })),
    fallback
  )
  return { hfov, measured }
}

// Heading h lands at yaw h in Pannellum (yaw 0 is the image center), so the
// panorama's yaw equals real-world compass heading. `horizonY` is the canvas
// row for pitch 0; `pxPerDeg` is [horizontal, vertical] scale.
function drawFrames(
  ctx: CanvasRenderingContext2D,
  frames: CapturedFrame[],
  hfov: number,
  width: number,
  horizonY: number,
  pxPerDeg: [number, number]
) {
  for (const { heading, pitch, image } of frames) {
    const w = hfov * pxPerDeg[0]
    const h = frameVfov(image, hfov) * pxPerDeg[1]
    const centerX = (((width / 2 + heading * pxPerDeg[0]) % width) + width) % width
    const centerY = horizonY - pitch * pxPerDeg[1]
    // Draw copies so frames crossing the left/right edge wrap around.
    for (const offset of [-width, 0, width]) {
      ctx.drawImage(image, centerX - w / 2 + offset, centerY - h / 2, w, h)
    }
  }
}

// Full 360x180 panorama, for the image model. Width and height needn't be 2:1.
export function stitchEquirect(frames: CapturedFrame[], hfov: number, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = GAP_COLOR
  ctx.fillRect(0, 0, width, height)
  drawFrames(ctx, frames, hfov, width, height / 2, [width / 360, height / 180])
  return canvas
}

// Vertical extent (degrees above/below the horizon) covered by *every* frame,
// so the preview has no blank rows. Falls back to the union if frames were
// tilted so differently that they share no rows.
export function bandExtent(
  frames: { pitch: number; image: { width: number; height: number } }[],
  hfov: number
): { top: number; bottom: number } {
  const tops = frames.map((f) => f.pitch + frameVfov(f.image, hfov) / 2)
  const bottoms = frames.map((f) => f.pitch - frameVfov(f.image, hfov) / 2)
  const top = Math.min(...tops)
  const bottom = Math.max(...bottoms)
  if (top > bottom) return { top, bottom }
  return { top: Math.max(...tops), bottom: Math.min(...bottoms) }
}

// Extra degrees of soft, blurred fill above and below the photos, so the
// preview can be shown at the camera's own zoom without empty space.
export const BAND_PADDING_DEG = 15

// The band to render: everything any frame covers plus padding, clamped to the
// sphere. The part only some frames cover, and the padding, get a blurred fill.
export function paddedExtent(
  frames: { pitch: number; image: { width: number; height: number } }[],
  hfov: number
): { top: number; bottom: number } {
  const top = Math.max(...frames.map((f) => f.pitch + frameVfov(f.image, hfov) / 2))
  const bottom = Math.min(...frames.map((f) => f.pitch - frameVfov(f.image, hfov) / 2))
  return { top: Math.min(90, top + BAND_PADDING_DEG), bottom: Math.max(-90, bottom - BAND_PADDING_DEG) }
}

// Fraction of each frame's height faded out at its top and bottom edges, so
// photos blend into the blurred fill instead of ending on a hard line.
const FEATHER = 0.12

function featherVertically(image: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = image.width
  out.height = image.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(image, 0, 0)
  const fade = ctx.createLinearGradient(0, 0, 0, image.height)
  fade.addColorStop(0, 'rgba(0,0,0,0)')
  fade.addColorStop(FEATHER, 'rgba(0,0,0,1)')
  fade.addColorStop(1 - FEATHER, 'rgba(0,0,0,1)')
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, image.width, image.height)
  return out
}

// Downscale factor for the blurred fill; bilinear upscaling of a tiny image is
// a cheap blur that works in every browser (canvas `filter` doesn't in older Safari).
const BLUR_FACTOR = 24

// The stitched band for an immersive preview: sharp photos over a blurred,
// vertically stretched copy of the sharp middle, so there is never blank space.
// Show it with haov 360, the returned vaov, and vOffset (the band's center
// relative to the horizon).
export function stitchBand(
  frames: CapturedFrame[],
  hfov: number,
  width: number
): { canvas: HTMLCanvasElement; vaov: number; vOffset: number } {
  const pxPerDeg = width / 360
  const { top, bottom } = paddedExtent(frames, hfov)
  const vaov = top - bottom
  const height = Math.round(vaov * pxPerDeg)

  const sharp = document.createElement('canvas')
  sharp.width = width
  sharp.height = height
  drawFrames(sharp.getContext('2d')!, frames, hfov, width, top * pxPerDeg, [pxPerDeg, pxPerDeg])
  const feathered = document.createElement('canvas')
  feathered.width = width
  feathered.height = height
  drawFrames(
    feathered.getContext('2d')!,
    frames.map((f) => ({ ...f, image: featherVertically(f.image) })),
    hfov,
    width,
    top * pxPerDeg,
    [pxPerDeg, pxPerDeg]
  )

  // Blur the rows every frame covers and stretch them over the whole band.
  const shared = bandExtent(frames, hfov)
  const sharedY = (top - shared.top) * pxPerDeg
  const sharedH = Math.max(1, (shared.top - shared.bottom) * pxPerDeg)
  const tiny = document.createElement('canvas')
  tiny.width = Math.max(1, Math.round(width / BLUR_FACTOR))
  tiny.height = Math.max(1, Math.round(sharedH / BLUR_FACTOR))
  const tinyCtx = tiny.getContext('2d')!
  tinyCtx.fillStyle = GAP_COLOR
  tinyCtx.fillRect(0, 0, tiny.width, tiny.height)
  tinyCtx.drawImage(sharp, 0, sharedY, width, sharedH, 0, 0, tiny.width, tiny.height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(tiny, 0, 0, width, height)
  ctx.drawImage(feathered, 0, 0)
  return { canvas, vaov, vOffset: (top + bottom) / 2 }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality)
  })
}
