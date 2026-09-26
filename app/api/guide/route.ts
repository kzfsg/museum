// Starts a GPT-Live voice session for the tour guide. The browser sends its
// WebRTC offer and the scene; this exchanges it with OpenAI for an answer so
// the API key never reaches the phone. Audio then flows browser <-> OpenAI.

import { guideInstructions, type GuideScene } from '@/src/lib/guide'

export const runtime = 'nodejs'

const LIVE_MODEL = process.env.OPENAI_GUIDE_MODEL || 'gpt-live-1'
// GPT-Live hands lookups ("when was this built?") to a text model with web search.
const BACKEND_MODEL = process.env.OPENAI_GUIDE_BACKEND_MODEL || 'gpt-5.5'
const VOICE = process.env.OPENAI_GUIDE_VOICE || 'marin'

const BACKEND_INSTRUCTIONS =
  'You research questions for a New York City walking-tour guide. Answer in two or three plain sentences a guide can say out loud. ' +
  'Prefer reliable sources (Wikipedia, NYC government, museums, newspapers). If you cannot confirm something, say so.'

export interface GuideRequest {
  sdp: string
  scene: GuideScene
}

export interface GuideResponse {
  sdp: string
  sessionId: string
}

function isScene(value: unknown): value is GuideScene {
  const s = value as GuideScene
  return Boolean(s) && typeof s.name === 'string' && typeof s.year === 'number' && Array.isArray(s.tidbits)
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return Response.json({ error: 'The tour guide needs OPENAI_API_KEY' }, { status: 503 })

  const body = (await req.json().catch(() => null)) as GuideRequest | null
  if (!body || typeof body.sdp !== 'string' || !isScene(body.scene)) {
    return Response.json({ error: 'Expected { sdp, scene }' }, { status: 400 })
  }

  const res = await fetch('https://api.openai.com/v1/live/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: {
        model: LIVE_MODEL,
        instructions: guideInstructions(body.scene),
        audio: { output: { voice: VOICE } },
        delegation: {
          type: 'responses',
          responses: {
            model: BACKEND_MODEL,
            instructions: BACKEND_INSTRUCTIONS,
            tools: [{ type: 'web_search' }],
            tool_choice: 'auto',
          },
        },
      },
      transport: { type: 'webrtc', sdp: body.sdp },
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error(`[guide] live session failed ${res.status} ${res.headers.get('x-request-id') ?? ''}: ${detail}`)
    return Response.json({ error: `Couldn't start the guide (${res.status})` }, { status: 502 })
  }

  const data = (await res.json()) as { session: { id: string }; transport: { sdp: string } }
  console.log(`[guide] session ${data.session.id} at ${body.scene.name} (${body.scene.year})`)
  return Response.json({ sdp: data.transport.sdp, sessionId: data.session.id } satisfies GuideResponse)
}
