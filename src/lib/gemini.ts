// Server-only REST adapter. Never put the key in URLs, client props or traces.
export interface GeminiPart {
  text?: string
  thought?: boolean
  inlineData?: { mimeType: string; data: string }
}
export interface GeminiResponse {
  candidates?: { finishReason?: string; content?: { parts?: GeminiPart[] } }[]
  promptFeedback?: { blockReason?: string }
}

export function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
}

export async function geminiContent(model: string, body: object, timeoutMs: number): Promise<GeminiResponse> {
  const key = geminiKey()
  if (!key) throw new Error('Gemini is not configured')
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  // Provider bodies may contain credentials or user data. Keep errors categorical.
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`)
  const result = await response.json() as GeminiResponse
  if (result.promptFeedback?.blockReason) throw new Error('Gemini blocked the request')
  return result
}

export function geminiText(result: GeminiResponse): string {
  return (result.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('')
}
