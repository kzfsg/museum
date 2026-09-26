// Rough panorama stitch: each captured frame is pasted onto an equirectangular
// canvas at its compass heading. No feature matching; the AI pass hides seams.

export interface CapturedFrame {
  heading: number
  image: HTMLCanvasElement
}

// Assumed horizontal field of view of a phone's main camera held in portrait.
export const CAMERA_HFOV_DEG = 50

// Gaps are filled with neutral gray so the model reads them as "missing".
const GAP_COLOR = '#808080'

// Heading h lands at yaw h in Pannellum (yaw 0 is the image center), so the
// panorama's yaw equals real-world compass heading.
export function stitchEquirect(frames: CapturedFrame[], width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = GAP_COLOR
  ctx.fillRect(0, 0, width, height)

  for (const { heading, image } of frames) {
    const hfov = CAMERA_HFOV_DEG
    const vfov = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) * (image.height / image.width)) * 180) / Math.PI
    const w = (hfov / 360) * width
    const h = (vfov / 180) * height
    const centerX = (((width / 2 + (heading / 360) * width) % width) + width) % width
    const x = centerX - w / 2
    const y = height / 2 - h / 2
    // Draw a second copy so frames crossing the left/right edge wrap around.
    for (const offset of [-width, 0, width]) {
      ctx.drawImage(image, x + offset, y, w, h)
    }
  }
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality)
  })
}
