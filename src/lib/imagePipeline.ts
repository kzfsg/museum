import sharp from 'sharp'
import { geminiContent, geminiKey } from './gemini'

export interface ImageAttempt {
  provider: 'gemini' | 'openai'
  model: string
  status: 'ok' | 'error'
  elapsedMs: number
  requestId?: string | null
}
export interface ImageResult {
  bytes: Uint8Array
  provider: 'gemini' | 'openai'
  model: string
  prompt: string
  attempts: ImageAttempt[]
}
export class ImagePipelineError extends Error {
  constructor(public attempts: ImageAttempt[]) { super('Image generation is unavailable. Please try again.') }
}
export interface ImageInput { image: Blob; mode: 'follow' | 'site'; prompt: string; fallbackPrompt: string }

async function jpeg(bytes: Buffer): Promise<Uint8Array> {
  if (!bytes.length || bytes.length > 25 * 1024 * 1024) throw new Error('Invalid image size')
  // Gemini can return PNG. Store real JPEG bytes, not PNG mislabeled as JPEG.
  return sharp(bytes, { limitInputPixels: 40_000_000 }).jpeg({ quality: 92 }).toBuffer()
}

export async function generateHistoricalImage(input: ImageInput): Promise<ImageResult> {
  const attempts: ImageAttempt[] = []
  if (geminiKey() && process.env.AI_PIPELINE !== 'legacy') {
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
    const started = Date.now()
    try {
      const parts: object[] = [{ text: input.prompt }]
      if (input.mode === 'follow') parts.push({ inlineData: { mimeType: input.image.type || 'image/jpeg', data: Buffer.from(await input.image.arrayBuffer()).toString('base64') } })
      const result = await geminiContent(model, {
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:2' } },
      }, 70_000)
      const image = result.candidates?.[0]?.content?.parts?.find(p => !p.thought && p.inlineData?.mimeType.startsWith('image/'))?.inlineData
      if (!image?.data) throw new Error('No Gemini image')
      const bytes = await jpeg(Buffer.from(image.data, 'base64'))
      attempts.push({ provider: 'gemini', model, status: 'ok', elapsedMs: Date.now() - started })
      return { bytes, provider: 'gemini', model, prompt: input.prompt, attempts }
    } catch {
      attempts.push({ provider: 'gemini', model, status: 'error', elapsedMs: Date.now() - started })
    }
  }
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
    const started = Date.now()
    let requestId: string | null = null
    try {
      const form = new FormData()
      form.set('model', model)
      form.set('image', input.image, 'scan.jpg')
      form.set('prompt', input.fallbackPrompt)
      form.set('size', '1536x1024')
      form.set('output_format', 'jpeg')
      const site = input.mode === 'site'
      const response = await fetch(`https://api.openai.com/v1/images/${site ? 'generations' : 'edits'}`, {
        method: 'POST', signal: AbortSignal.timeout(150_000),
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...(site ? { 'Content-Type': 'application/json' } : {}) },
        body: site ? JSON.stringify({ model, prompt: input.fallbackPrompt, size: '1536x1024', output_format: 'jpeg' }) : form,
      })
      requestId = response.headers.get('x-request-id')
      if (!response.ok) throw new Error('OpenAI image unavailable')
      const json = await response.json() as { data?: { b64_json?: string }[] }
      if (!json.data?.[0]?.b64_json) throw new Error('No OpenAI image')
      const bytes = await jpeg(Buffer.from(json.data[0].b64_json, 'base64'))
      attempts.push({ provider: 'openai', model, status: 'ok', elapsedMs: Date.now() - started, requestId })
      return { bytes, provider: 'openai', model, prompt: input.fallbackPrompt, attempts }
    } catch {
      attempts.push({ provider: 'openai', model, status: 'error', elapsedMs: Date.now() - started, requestId })
    }
  }
  throw new ImagePipelineError(attempts)
}
