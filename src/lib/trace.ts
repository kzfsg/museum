// A record of one generation, so a result can be traced back to exactly what
// produced it: the stitched image sent to the model, the prompt, the history
// data behind the prompt, what the phone reported, timings, and the outcome.
// Stored in the Blob store under traces/ (separate from scans/).

import { get, list, put } from '@vercel/blob'
import type { Building } from '@/src/lib/building'
import type { History } from '@/src/lib/history'

// What the phone reports about the capture (sent by the client as JSON).
export interface CaptureInfo {
  frames?: { heading: number; pitch: number }[]
  frameSize?: [number, number]
  lensHfov?: number
  lensMeasured?: boolean
  userAgent?: string
}

export interface Trace {
  id: string
  createdAt: string
  request: {
    year: number
    lat: number | null
    lng: number | null
    accuracyM: number | null
    startYaw: number
    inputBytes: number
    inputType: string
  }
  capture: CaptureInfo | null
  history: History | null
  // The building the scan was taken in, if any, and which mode that implied:
  // follow (repaint the scan) or site (the building didn't exist yet).
  building: Building | null
  mode: 'follow' | 'site'
  note: string | null
  prompt: string
  model: string
  timingsMs: Record<string, number>
  outcome:
    | { status: 'ok'; openaiRequestId: string | null; outputBytes: number; savedScanId: string | null }
    | { status: 'error'; stage: string; message: string; openaiRequestId?: string | null }
  inputPath: string
  outputPath: string | null
}

const PREFIX = 'traces/'

export function tracePaths(id: string) {
  return { json: `${PREFIX}${id}.json`, input: `${PREFIX}${id}-input.jpg`, output: `${PREFIX}${id}-output.jpg` }
}

export function isTraceImagePath(path: string): boolean {
  return /^traces\/[\w-]+-(input|output)\.jpg$/.test(path)
}

export function newTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Parses the client's capture JSON, ignoring anything malformed.
export function parseCaptureInfo(raw: FormDataEntryValue | null): CaptureInfo | null {
  if (typeof raw !== 'string' || raw.length > 20_000) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? (value as CaptureInfo) : null
  } catch {
    return null
  }
}

export async function saveTraceInput(id: string, image: Blob): Promise<void> {
  await put(tracePaths(id).input, image, { access: 'private', contentType: 'image/jpeg' })
}

export async function saveTraceOutput(id: string, bytes: Uint8Array): Promise<void> {
  await put(tracePaths(id).output, new Blob([bytes], { type: 'image/jpeg' }), { access: 'private', contentType: 'image/jpeg' })
}

export async function saveTrace(trace: Trace): Promise<void> {
  await put(tracePaths(trace.id).json, JSON.stringify(trace, null, 2), { access: 'private', contentType: 'application/json' })
}

// Most recent first (ids start with a timestamp).
export async function listTraceIds(limit: number): Promise<string[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  return blobs
    .map((b) => /^traces\/([\w-]+)\.json$/.exec(b.pathname)?.[1])
    .filter((id): id is string => Boolean(id))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
}

export async function readTrace(id: string): Promise<Trace | null> {
  if (!/^[\w-]+$/.test(id)) return null
  const result = await get(tracePaths(id).json, { access: 'private' })
  if (!result || result.statusCode !== 200) return null
  return (await new Response(result.stream).json()) as Trace
}

// Scans and traces are both named `<ms timestamp>-<random>`.
function idTime(id: string): number {
  return Number(id.split('-')[0])
}

// A generation's trace starts before the scan it saves, by at most the
// generate route's time limit. Trace ids that could belong to `scanId`, nearest first.
export function traceCandidatesForScan(scanId: string, traceIds: string[], windowMs = 300_000): string[] {
  const saved = idTime(scanId)
  return traceIds
    .filter((id) => {
      const started = idTime(id)
      return started <= saved && saved - started <= windowMs
    })
    .sort((a, b) => idTime(b) - idTime(a))
}

// Every blob under traces/ (one list call), to look scans' traces up in.
export async function listTraceBlobPaths(): Promise<Set<string>> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 })
  return new Set(blobs.map((b) => b.pathname))
}

// The present-day panorama of a scan saved before scans kept their own copy:
// the input of the trace that saved it, if that upload made it into the store.
export async function findScanTraceInput(scanId: string, tracePathnames: Set<string>): Promise<string | null> {
  const traceIds = [...tracePathnames].map((p) => /^traces\/([\w-]+)\.json$/.exec(p)?.[1]).filter((id): id is string => Boolean(id))
  for (const id of traceCandidatesForScan(scanId, traceIds)) {
    const trace = await readTrace(id)
    if (trace?.outcome.status !== 'ok' || trace.outcome.savedScanId !== scanId) continue
    return tracePathnames.has(trace.inputPath) ? trace.inputPath : null
  }
  return null
}
