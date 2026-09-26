// Streams a saved scan image out of the private Blob store.

import { get } from '@vercel/blob'
import { isScanImagePath } from '@/src/lib/scanStore'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get('path') ?? ''
  if (!isScanImagePath(path)) return new Response('Not found', { status: 404 })

  const result = await get(path, { access: 'private' })
  if (!result || result.statusCode !== 200) return new Response('Not found', { status: 404 })

  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      // Scans are never overwritten, so the browser can keep them.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
