// Turns a rough present-day panorama into the same place in a past year using
// OpenAI's image edit endpoint, grounded in what's known about the location.
// Saves the result when the scan has a location and storage is configured, and
// records a trace of every step (see src/lib/trace.ts and /trace).

import { findBuilding } from '@/src/lib/building'
import { fetchHistory, historyTidbits, type History } from '@/src/lib/history'
import { buildPrompt, buildSitePrompt, siteNote } from '@/src/lib/prompt'
import { saveScan, scanImageUrl, scanStoreEnabled, type SavedScan } from '@/src/lib/scanStore'
import {
  newTraceId,
  parseCaptureInfo,
  saveTrace,
  saveTraceInput,
  saveTraceOutput,
  tracePaths,
  type Trace,
} from '@/src/lib/trace'
import type { Tidbit } from '@/src/data/places'

export const runtime = 'nodejs'
export const maxDuration = 300

const MIN_YEAR = 1600
const MAX_YEAR = 2000

export interface GenerateResponse {
  imageUrl: string
  tidbits: Tidbit[]
  saved: SavedScan | null
  traceId: string
  // Set in site mode, e.g. "This building opened in 1999. Here's the site in 1920."
  note: string | null
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
  const accuracyM = optionalNumber(form.get('accuracy'))
  const startYaw = optionalNumber(form.get('startYaw')) ?? 0
  if (!(image instanceof Blob)) {
    return Response.json({ error: 'Missing image.' }, { status: 400 })
  }
  // Tidbits come from the location, and a scan without them isn't worth making.
  if (lat === null || lng === null) {
    return Response.json({ error: 'Missing location. Allow location access and try again.' }, { status: 400 })
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return Response.json({ error: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.` }, { status: 400 })
  }

  const tracing = scanStoreEnabled()
  const traceId = newTraceId()
  const started = Date.now()
  const timingsMs: Record<string, number> = {}
  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1'
  const trace: Trace = {
    id: traceId,
    createdAt: new Date().toISOString(),
    request: { year, lat, lng, accuracyM, startYaw, inputBytes: image.size, inputType: image.type },
    capture: parseCaptureInfo(form.get('capture')),
    history: null,
    building: null,
    mode: 'follow',
    note: null,
    prompt: '',
    model,
    timingsMs,
    outcome: { status: 'error', stage: 'start', message: 'did not finish' },
    inputPath: tracePaths(traceId).input,
    outputPath: null,
  }

  // Tracing must never break a generation.
  const inputSaved = tracing ? saveTraceInput(traceId, image).catch((e) => console.error('Trace input save failed', e)) : null
  async function finish(response: Response): Promise<Response> {
    timingsMs.total = Date.now() - started
    console.log('[trace]', JSON.stringify({ id: traceId, ...trace.request, mode: trace.mode, building: trace.building, outcome: trace.outcome, timingsMs }))
    if (tracing) {
      await inputSaved
      await saveTrace(trace).catch((e) => console.error('Trace save failed', e))
    }
    return response
  }

  const hasLocation = lat !== null && lng !== null
  let t = Date.now()
  const [history, building] = hasLocation
    ? await Promise.all([fetchHistory(lat, lng), findBuilding(lat, lng, accuracyM)])
    : [null, null]
  timingsMs.history = Date.now() - t
  trace.history = history
  trace.building = building
  // Checked before the (slow, paid) image generation, not after.
  if (!history || historyTidbits(history, year).length === 0) {
    trace.outcome = { status: 'error', stage: 'history', message: 'no tidbits found' }
    return finish(Response.json({ error: 'Couldn’t find any history around here, so there’s nothing to pin. Try again in a moment.' }, { status: 502 }))
  }

  // Site mode: the building the scan was taken in didn't exist yet, so show
  // the site instead of repainting the scan (which would invent a room that
  // was never there).
  const note = siteNote(year, building)
  trace.note = note
  trace.mode = note && building ? 'site' : 'follow'
  trace.prompt = note && building ? buildSitePrompt(year, history, building) : buildPrompt(year, history)

  t = Date.now()
  const res =
    trace.mode === 'site'
      ? await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt: trace.prompt, size: '1536x1024', output_format: 'jpeg' }),
        })
      : await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: editRequest(model, image, trace.prompt),
        })
  timingsMs.openai = Date.now() - t
  const openaiRequestId = res.headers.get('x-request-id')
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500)
    trace.outcome = { status: 'error', stage: 'openai', message: `${res.status}: ${detail}`, openaiRequestId }
    return finish(Response.json({ error: `Image API returned ${res.status}: ${detail}` }, { status: 502 }))
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    trace.outcome = { status: 'error', stage: 'openai', message: 'no image in response', openaiRequestId }
    return finish(Response.json({ error: 'Image API returned no image.' }, { status: 502 }))
  }

  const tidbits = history ? historyTidbits(history, year) : []
  const bytes = Buffer.from(b64, 'base64')

  t = Date.now()
  let saved: SavedScan | null = null
  if (hasLocation && scanStoreEnabled()) {
    try {
      saved = await saveScan(new Blob([bytes], { type: 'image/jpeg' }), { lat, lng, year, startYaw, tidbits, note }, image)
    } catch (e) {
      // The user still gets their image; it just won't be reusable.
      console.error('Failed to save scan', e)
    }
  }
  if (tracing) {
    await saveTraceOutput(traceId, bytes).catch((e) => console.error('Trace output save failed', e))
    trace.outputPath = tracePaths(traceId).output
  }
  timingsMs.save = Date.now() - t

  trace.outcome = { status: 'ok', openaiRequestId, outputBytes: bytes.length, savedScanId: saved?.id ?? null }
  const response: GenerateResponse = {
    imageUrl: saved ? scanImageUrl(saved.imagePath) : `data:image/jpeg;base64,${b64}`,
    tidbits,
    saved,
    traceId,
    note,
  }
  return finish(Response.json(response))
}

function editRequest(model: string, image: Blob, prompt: string): FormData {
  const body = new FormData()
  body.set('model', model)
  body.set('image', image, 'scan.jpg')
  body.set('prompt', prompt)
  body.set('size', '1536x1024')
  body.set('output_format', 'jpeg')
  return body
}
