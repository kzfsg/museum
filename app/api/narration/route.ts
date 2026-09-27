import { narrationEnabled, narrationRequest, speakNarration } from '@/src/lib/narration'

export const runtime = 'nodejs'
export const maxDuration = 30

export function GET() {
  return Response.json({ available: narrationEnabled() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request) {
  if (!narrationEnabled()) return Response.json({ error: 'Audio narration is unavailable; use the live guide.', fallback: 'openai-live' }, { status: 503 })
  // Bound the paid TTS input, including requests not made through our UI.
  const raw = await req.text()
  if (raw.length > 12_000) return Response.json({ error: 'Narration request too large.' }, { status: 413 })
  let input
  try { input = narrationRequest.parse(JSON.parse(raw)) } catch {
    return Response.json({ error: 'Expected a year and a short historical tidbit.' }, { status: 400 })
  }
  try {
    return new Response(await speakNarration(input), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-Voice-Provider': 'elevenlabs' },
    })
  } catch {
    return Response.json({ error: 'Audio narration is unavailable; use the live guide.', fallback: 'openai-live' }, { status: 502 })
  }
}
