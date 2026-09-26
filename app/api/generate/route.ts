// Turns a rough present-day panorama into the same place in a past year using
// OpenAI's image edit endpoint. Returns the edited image as JPEG bytes.

export const runtime = 'nodejs'
export const maxDuration = 300

const MIN_YEAR = 1600
const MAX_YEAR = 2000

function buildPrompt(year: number) {
  return [
    'This is a rough 360-degree equirectangular panorama of a street in New York City, photographed today.',
    'It was stitched from phone photos, so it has seams, and the gray areas are missing sky and ground.',
    `Recreate it as a realistic photograph of this exact spot in ${year}.`,
    'Keep every street, building, and landmark in the same position and shape.',
    `Replace modern vehicles, signage, storefronts, clothing, and street furniture with what would have been there in ${year}.`,
    'Fill in the sky and ground naturally, remove the seams, and keep it a seamless equirectangular panorama whose left and right edges connect.',
  ].join(' ')
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY is not set on the server.' }, { status: 501 })
  }

  const form = await req.formData()
  const image = form.get('image')
  const year = Number(form.get('year'))
  if (!(image instanceof Blob)) {
    return Response.json({ error: 'Missing image.' }, { status: 400 })
  }
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return Response.json({ error: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.` }, { status: 400 })
  }

  const body = new FormData()
  body.set('model', process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1')
  body.set('image', image, 'scan.jpg')
  body.set('prompt', buildPrompt(year))
  body.set('size', '1536x1024')
  body.set('output_format', 'jpeg')

  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500)
    return Response.json({ error: `Image API returned ${res.status}: ${detail}` }, { status: 502 })
  }

  const json = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = json.data?.[0]?.b64_json
  if (!b64) {
    return Response.json({ error: 'Image API returned no image.' }, { status: 502 })
  }
  return new Response(Buffer.from(b64, 'base64'), { headers: { 'Content-Type': 'image/jpeg' } })
}
