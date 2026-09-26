// Turns a rough present-day panorama into the same place in a past year using
// OpenAI's image edit endpoint, grounded in what's known about the location.
// Saves the result when the scan has a location and storage is configured.

import { fetchHistory, historyTidbits, type History } from '@/src/lib/history'
import { buildPrompt } from '@/src/lib/prompt'
import { saveScan, scanImageUrl, scanStoreEnabled, type SavedScan } from '@/src/lib/scanStore'
import type { Tidbit } from '@/src/data/places'

export const runtime = 'nodejs'
export const maxDuration = 300

const MIN_YEAR = 1600
const MAX_YEAR = 2000

export interface GenerateResponse {
  imageUrl: string
  tidbits: Tidbit[]
  saved: SavedScan | null
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set on the server.' }, { status: 501 })
  }

  const form = await req.formData()
  const image = form.get('image')
  const year = Number(form.get('year'))
  const lat = optionalNumber(form.get('lat'))
  const lng = optionalNumber(form.get('lng'))
  const startYaw = optionalNumber(form.get('startYaw')) ?? 0
  if (!(image instanceof Blob)) {
    return Response.json({ error: 'Missing image.' }, { status: 400 })
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return Response.json({ error: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.` }, { status: 400 })
  }

  const hasLocation = lat !== null && lng !== null
  const history: History | null = hasLocation ? await fetchHistory(lat, lng) : null

  const body = new FormData()
  body.set('model', process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1')
  body.set('image', image, 'scan.jpg')
  body.set('prompt', buildPrompt(year, history))
  body.set('size', '1536x1024')
  body.set('output_format', 'jpeg')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500)
    return Response.json({ error: `Image API returned ${res.status}: ${detail}` }, { status: 502 })
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    return Response.json({ error: 'Image API returned no image.' }, { status: 502 })
  }

  const tidbits = history ? historyTidbits(history, year) : []
  const bytes = Buffer.from(b64, 'base64')

  let saved: SavedScan | null = null
  if (hasLocation && scanStoreEnabled()) {
    try {
      saved = await saveScan(new Blob([bytes], { type: 'image/jpeg' }), { lat, lng, year, startYaw, tidbits })
    } catch (e) {
      // The user still gets their image; it just won't be reusable.
      console.error('Failed to save scan', e)
    }
  }

  const response: GenerateResponse = {
    imageUrl: saved ? scanImageUrl(saved.imagePath) : `data:image/jpeg;base64,${b64}`,
    tidbits,
    saved,
  }
  return Response.json(response)
}
