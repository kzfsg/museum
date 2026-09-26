// A record of one generation, so a result can be traced back to exactly what
// produced it: the stitched image sent to the model, the prompt, the history
// data behind the prompt, what the phone reported, timings, and the outcome.
// Stored in the Blob store under traces/ (separate from scans/).

import { get, list, put } from '@vercel/blob'
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
    startYaw: number
    inputBytes: number
    inputType: string
  }
  capture: CaptureInfo | null
  history: History | null
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
