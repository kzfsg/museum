import { z } from 'zod'

export const narrationRequest = z.object({
  year: z.number().int().min(1600).max(2100),
  tidbit: z.object({
    title: z.string().min(1).max(250),
    body: z.string().min(1).max(2000),
    narration: z.string().min(1).max(650).optional(),
    narrationProvider: z.literal('gemini').optional(),
  }),
})

export function narrationEnabled(): boolean {
  return process.env.AI_PIPELINE !== 'legacy' && Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID)
}

export async function speakNarration(input: z.infer<typeof narrationRequest>): Promise<ArrayBuffer> {
  if (!narrationEnabled()) throw new Error('Narration is not configured')
  // The saved Gemini script stays with its sourced hotspot. Older scans read their
  // existing text, so browsing them never requires regenerating the panorama.
  const script = input.tidbit.narrationProvider === 'gemini' && input.tidbit.narration
    ? input.tidbit.narration
    : `${input.tidbit.title}. ${input.tidbit.body}`
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID!)}?output_format=mp3_44100_128`, {
    method: 'POST', signal: AbortSignal.timeout(20_000),
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: `Looking back to ${input.year}. ${script}`, model_id: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' }),
  })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Narration unavailable')
  const audio = await response.arrayBuffer()
  if (!audio.byteLength || audio.byteLength > 5 * 1024 * 1024) throw new Error('Invalid narration audio')
  return audio
}
