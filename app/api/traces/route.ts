// GET /api/traces          -> recent generation traces (summaries)
// GET /api/traces?id=...   -> one full trace

import { scanStoreEnabled } from '@/src/lib/scanStore'
import { listTraceIds, readTrace } from '@/src/lib/trace'

export const runtime = 'nodejs'

const MAX_RESULTS = 20

export async function GET(req: Request) {
  if (!scanStoreEnabled()) return Response.json({ traces: [] })

  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const trace = await readTrace(id)
    return trace ? Response.json({ trace }) : Response.json({ error: 'Not found' }, { status: 404 })
  }

  const ids = await listTraceIds(MAX_RESULTS)
  const traces = await Promise.all(ids.map((traceId) => readTrace(traceId)))
  return Response.json({
    traces: traces
      .filter((t) => t !== null)
      .map((t) => ({ id: t.id, createdAt: t.createdAt, year: t.request.year, lat: t.request.lat, lng: t.request.lng, status: t.outcome.status })),
  })
}
