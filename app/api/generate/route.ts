// Turns a rough present-day panorama into the same place in a past year using
// Gemini with the existing OpenAI image endpoint as fallback, grounded in what's known about the location.
// Saves the result when the scan has a location and storage is configured, and
// records a trace of every step (see src/lib/trace.ts and /trace).

import { findBuilding } from '@/src/lib/building'
import { fetchHistory, historyTidbits } from '@/src/lib/history'
import { topUpTidbits } from '@/src/lib/moreTidbits'
import { geminiKey } from '@/src/lib/gemini'
import { planResearch, researchedPrompt, withNarrations } from '@/src/lib/researchPlan'
import { generateHistoricalImage, ImagePipelineError } from '@/src/lib/imagePipeline'
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
  generation: NonNullable<SavedScan['generation']>
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
  if (!apiKey && (!geminiKey() || process.env.AI_PIPELINE === 'legacy')) {
    return Response.json({ error: 'Configure GEMINI_API_KEY or OPENAI_API_KEY on the server.' }, { status: 501 })
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
  if (image.size > 15 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
    return Response.json({ error: 'Use a JPEG, PNG or WebP scan under 15 MB.' }, { status: 400 })
  }
  // Tidbits come from the location, and a scan without them isn't worth making.
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
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

  // Made while the image generates; never rejects.
  const tidbitsStarted = Date.now()
  const tidbitsReady = topUpTidbits(
    history ? historyTidbits(history, year) : [],
    year,
    { lat, lng, nearby: history?.articles.map((a) => a.title) ?? [] },
    apiKey || ''
  ).then((tidbits) => {
    timingsMs.tidbits = Date.now() - tidbitsStarted
    return tidbits
  })

  const basePrompt = trace.prompt
  const researchStarted = Date.now()
  const research = await planResearch(year, history, historyTidbits(history, year), trace.mode)
  timingsMs.research = Date.now() - researchStarted
  trace.research = research
  let generated
  try {
    generated = await generateHistoricalImage({ image, mode: trace.mode, prompt: researchedPrompt(basePrompt, research.plan), fallbackPrompt: basePrompt })
  } catch (error) {
    trace.imageAttempts = error instanceof ImagePipelineError ? error.attempts : []
    trace.outcome = { status: 'error', stage: 'image', message: 'All configured image providers failed' }
    return finish(Response.json({ error: 'Image generation is unavailable. Please try again.', traceId }, { status: 502 }))
  }
  trace.prompt = generated.prompt
  trace.model = generated.model
  trace.imageProvider = generated.provider
  trace.imageAttempts = generated.attempts
  const openaiRequestId = generated.attempts.find(a => a.provider === 'openai')?.requestId ?? null
  const tidbits = withNarrations(await tidbitsReady, research)
  const bytes = generated.bytes
  const b64 = Buffer.from(bytes).toString('base64')
  const generation = {
    imageProvider: generated.provider,
    imageModel: generated.model,
    researchProvider: research.provider,
    researchModel: research.status === 'ok' ? research.model : undefined,
    fallback: generated.attempts.some(a => a.status === 'error'),
    traceId,
  }

  t = Date.now()
  let saved: SavedScan | null = null
  if (hasLocation && scanStoreEnabled()) {
    try {
      saved = await saveScan(new Blob([bytes], { type: 'image/jpeg' }), { lat, lng, year, startYaw, tidbits, note, generation }, image)
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
    generation,
    note,
  }
  return finish(Response.json(response))
}
