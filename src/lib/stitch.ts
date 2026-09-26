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

// Only the band every frame covers, for an immersive preview with no blank
// space. Show it with haov 360, the returned vaov, and vOffset (the band's
// center relative to the horizon).
export function stitchBand(
  frames: CapturedFrame[],
  hfov: number,
  width: number
): { canvas: HTMLCanvasElement; vaov: number; vOffset: number } {
  const pxPerDeg = width / 360
  const { top, bottom } = bandExtent(frames, hfov)
  const vaov = top - bottom

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round(vaov * pxPerDeg)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = GAP_COLOR
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // Pitch 0 sits `top` degrees below the canvas's top edge.
  drawFrames(ctx, frames, hfov, width, top * pxPerDeg, [pxPerDeg, pxPerDeg])
  return { canvas, vaov, vOffset: (top + bottom) / 2 }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality)
  })
}
