// Rough panorama stitch: each captured frame is pasted onto an equirectangular
// canvas at its compass heading. No feature matching; the AI pass hides seams.

export interface CapturedFrame {
  heading: number
  // Degrees above the horizon the camera pointed when the frame was taken.
  pitch: number
  image: HTMLCanvasElement
}

// Horizontal field of view of a phone's main camera held in portrait, for a
// 16:9 video stream: a ~26 mm-equivalent lens sees ~69 degrees across the long
// side, and the short side of a 16:9 crop is 2*atan(tan(34.6 deg) * 9/16) ~ 42.
export const CAMERA_HFOV_DEG = 42

// Gaps are filled with neutral gray so the model reads them as "missing".
const GAP_COLOR = '#808080'

export function frameVfov(image: { width: number; height: number }): number {
  return (2 * Math.atan(Math.tan((CAMERA_HFOV_DEG * Math.PI) / 360) * (image.height / image.width)) * 180) / Math.PI
}

// Heading h lands at yaw h in Pannellum (yaw 0 is the image center), so the
// panorama's yaw equals real-world compass heading. `horizonY` is the canvas
// row for pitch 0; `pxPerDeg` is [horizontal, vertical] scale.
function drawFrames(
  ctx: CanvasRenderingContext2D,
  frames: CapturedFrame[],
  width: number,
  horizonY: number,
  pxPerDeg: [number, number]
) {
  for (const { heading, pitch, image } of frames) {
    const w = CAMERA_HFOV_DEG * pxPerDeg[0]
    const h = frameVfov(image) * pxPerDeg[1]
    const centerX = (((width / 2 + heading * pxPerDeg[0]) % width) + width) % width
    const centerY = horizonY - pitch * pxPerDeg[1]
    // Draw copies so frames crossing the left/right edge wrap around.
    for (const offset of [-width, 0, width]) {
      ctx.drawImage(image, centerX - w / 2 + offset, centerY - h / 2, w, h)
    }
  }
}

// Full 360x180 panorama, for the image model. Width and height needn't be 2:1.
export function stitchEquirect(frames: CapturedFrame[], width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = GAP_COLOR
  ctx.fillRect(0, 0, width, height)
  drawFrames(ctx, frames, width, height / 2, [width / 360, height / 180])
  return canvas
}

// Only the band the frames actually cover, for an immersive preview with no
// gray caps. Show it with haov 360 and the returned vaov.
export function stitchBand(frames: CapturedFrame[], width: number): { canvas: HTMLCanvasElement; vaov: number } {
  const pxPerDeg = width / 360
  // The band spans from the lowest frame bottom to the highest frame top.
  const top = Math.max(...frames.map((f) => f.pitch + frameVfov(f.image) / 2))
  const bottom = Math.min(...frames.map((f) => f.pitch - frameVfov(f.image) / 2))
  // Keep the horizon centered so Pannellum's pitch 0 stays level.
  const half = Math.min(90, Math.max(top, -bottom))
  const vaov = 2 * half

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round(vaov * pxPerDeg)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = GAP_COLOR
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  drawFrames(ctx, frames, width, canvas.height / 2, [pxPerDeg, pxPerDeg])
  return { canvas, vaov }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality)
  })
}
