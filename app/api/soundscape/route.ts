// Picks how a scene sounds: a vision model looks at the panorama and chooses
// layers from the CC0 library in public/sounds. The year rules in
// src/lib/soundscape.ts are applied to its pick. Without OPENAI_API_KEY, or if
// the model fails, an era-typical mix is returned instead.

import { get } from '@vercel/blob'
import { isScanImagePath } from '@/src/lib/scanStore'
import { LAYERS, LAYER_IDS, fallbackMix, sanitizeMix, type Layer, type SoundscapeMix } from '@/src/lib/soundscape'

export const runtime = 'nodejs'

const MODEL = process.env.OPENAI_SOUND_MODEL || 'gpt-5.4-mini'
const TIMEOUT_MS = 20000

export interface SoundscapeRequest {
  // The panorama: a data: URL, a saved scan's /api/scans/image URL, or a public path.
  image: string
  year: number
  name?: string
  neighborhood?: string
  note?: string | null
  tidbits?: string[]
}

export interface SoundscapeResponse extends SoundscapeMix {
  source: 'model' | 'fallback'
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['indoor', 'layers', 'caption'],
  properties: {
    indoor: { type: 'boolean', description: 'Whether the scene is inside a building.' },
    layers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'volume'],
        properties: {
          id: { type: 'string', enum: LAYER_IDS },
          volume: { type: 'number', description: '0.1 (faint, distant) to 1 (dominant).' },
        },
      },
    },
    caption: { type: 'string', description: 'What the listener hears, in under 12 lowercase words.' },
  },
}

function instructions(body: SoundscapeRequest): string {
  const library = LAYER_IDS.map((id) => {
    const l: Layer = LAYERS[id]
    const where = l.indoor === true ? ', indoors only' : l.indoor === false ? ', outdoors only' : ''
    return `- ${id}: ${l.label} (${l.kind === 'bed' ? 'continuous' : 'now and then'}; ${l.from}-${l.to}${where})`
  }).join('\n')
  return [
    `You design the ambient sound for a reconstruction of a place in New York City in ${body.year}.`,
    body.name ? `Place: ${body.name}${body.neighborhood ? ` (${body.neighborhood})` : ''}.` : '',
    body.note ? `Note: ${body.note}` : '',
    body.tidbits?.length ? `Nearby: ${body.tidbits.slice(0, 8).join('; ')}.` : '',
    `Look at the image (a 360° panorama) and pick 2 to 5 sounds from this library that someone standing there in ${body.year} would hear:`,
    library,
    `Only use sounds whose years include ${body.year}, and only what fits what's visible: water and gulls only by a waterfront, farm animals only in open country, diner chatter only in an eatery.`,
    `Include at least one continuous sound. Make the most prominent sound loudest.`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function imageDataUrl(image: string, req: Request): Promise<string | null> {
  if (image.startsWith('data:image/')) return image
  if (!image.startsWith('/') || image.startsWith('//')) return null
  const url = new URL(image, req.url)
  // Only ever fetch our own pages, never an arbitrary host.
  if (url.origin !== new URL(req.url).origin) return null
  const path = url.searchParams.get('path')
  let res: Response | null = null
  if (url.pathname === '/api/scans/image' && path && isScanImagePath(path)) {
    // Read saved scans straight from the store rather than through our own URL.
    const blob = await get(path, { access: 'private' })
    if (blob?.statusCode === 200) res = new Response(blob.stream, { headers: { 'Content-Type': blob.blob.contentType } })
  } else {
    res = await fetch(url)
  }
  if (!res?.ok) return null
  const type = res.headers.get('content-type') ?? 'image/jpeg'
  if (!type.startsWith('image/')) return null
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
}

async function pickMix(body: SoundscapeRequest, req: Request, apiKey: string): Promise<SoundscapeMix | null> {
  const image = await imageDataUrl(body.image, req)
  if (!image) return null
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: instructions(body) },
            { type: 'input_image', image_url: image, detail: 'low' },
          ],
        },
      ],
      text: { format: { type: 'json_schema', name: 'soundscape', strict: true, schema: SCHEMA } },
    }),
  })
  if (!res.ok) {
    console.error(`[soundscape] ${MODEL} returned ${res.status}: ${(await res.text()).slice(0, 300)}`)
    return null
  }
  const json = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[] }
  const text = json.output?.flatMap((o) => o.content ?? []).find((c) => c.type === 'output_text')?.text
  if (!text) return null
  return sanitizeMix(JSON.parse(text), body.year)
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as SoundscapeRequest | null
  if (!body || typeof body.image !== 'string' || typeof body.year !== 'number' || !Number.isFinite(body.year)) {
    return Response.json({ error: 'Expected { image, year }' }, { status: 400 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  let mix: SoundscapeMix | null = null
  if (apiKey) {
    try {
      mix = await pickMix(body, req, apiKey)
    } catch (e) {
      console.error('[soundscape] pick failed', e)
    }
  }
  const response: SoundscapeResponse = mix ? { ...mix, source: 'model' } : { ...fallbackMix(body.year), source: 'fallback' }
  console.log(`[soundscape] ${body.year} ${response.source}: ${response.layers.map((l) => `${l.id}@${l.volume}`).join(' ')}`)
  return Response.json(response)
}
