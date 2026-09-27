# Submission pipeline

Branch: `codex/submission`. The existing OpenAI and Blob paths remain the fallback.

## Request flow

1. Capture and stitch the phone panorama as before. Fetch nearby Wikipedia extracts and NYC PLUTO construction dates; determine whether to repaint the capture (`follow`) or generate the earlier outdoor site (`site`). No usable history means no image request.
2. Gemini 2.5 Flash receives that retrieved evidence and the existing sourced hotspots. It returns a bounded JSON plan: visual notes linked to evidence IDs and short spoken narrations linked to hotspot IDs. Unknown references, duplicate hotspot scripts, malformed JSON, timeouts and provider errors discard the plan. The existing deterministic prompt remains authoritative. Source IDs constrain references; they do **not** independently prove the model's prose is factually correct. This is a historical interpretation, not verified archival imagery.
3. Gemini's image model receives the prompt and original scan in follow mode, or only the prompt in site mode. If it fails, the original OpenAI image API receives the **original deterministic prompt**, original scan and existing model settings. Research has a 15-second deadline, Gemini image generation 70 seconds, OpenAI 150 seconds, leaving room in the 300-second route for lookup and storage. PNG/WebP outputs are decoded and converted to actual JPEGs for the existing Blob paths and Pannellum viewer. Images retain their generated dimensions; the viewer's explicit 360°/180° coverage handles projection as before.
4. Store the image and original capture in private Blob. Store the scan sidecar with sourced hotspots, Gemini narration (when available), successful image/research provider and model, fallback flag and trace ID. Index the same metadata in MongoDB with a longitude-first GeoJSON point. MongoDB errors leave the Blob copy available for recovery.
5. The map queries MongoDB when configured, falling back to Blob on an outage. Opening a saved view does not generate a new image. See [mongodb.md](mongodb.md) for the idempotent existing-scan import and how to verify a real MongoDB lookup.
6. The headphone control first checks ElevenLabs availability. With a configured voice, it narrates the hotspot ahead and new hotspots as the visitor turns; tapping a hotspot or its listen button also narrates it. New scans use the saved Gemini script; older scans read the saved factual text. Audio is cached in memory during the tour and released on exit. This primary path is **narrated playback, not two-way Gemini voice chat**. ElevenLabs failure or missing configuration starts the existing OpenAI Live conversation, which requests microphone permission. The UI shows the active mode. The current live guide's research delegation is unchanged.

## Server configuration

Configure these in ignored `.env.local` and the deployment environment. Never use `NEXT_PUBLIC_` for a secret.

```dotenv
# Preferred research and image generation
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_RESEARCH_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image

# Preferred narrated tour; choose a voice available to your ElevenLabs account
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
ELEVENLABS_MODEL=eleven_multilingual_v2

# Existing fallback credentials and settings
OPENAI_API_KEY=your_existing_key
OPENAI_IMAGE_MODEL=gpt-image-1
# OPENAI_TIDBIT_MODEL, OPENAI_GUIDE_MODEL, OPENAI_GUIDE_BACKEND_MODEL,
# and OPENAI_GUIDE_VOICE retain their existing behavior.

# Saved scan metadata and media
MONGODB_URI=mongodb+srv://your_atlas_connection_string
MONGODB_DB=time_machine
BLOB_READ_WRITE_TOKEN=your_existing_blob_token
```

`GOOGLE_API_KEY` is accepted if `GEMINI_API_KEY` is absent. `AI_PIPELINE=legacy` disables both Gemini and ElevenLabs, restoring the current OpenAI paths; MongoDB remains independently configurable. Omit `MONGODB_URI` to use the original Blob lookup. Gemini-only image generation works without OpenAI, but there is then no OpenAI image or live voice fallback. Missing OpenAI fact top-up uses the existing city milestones.

A valid Gemini key with zero image quota or no prepaid credit will still fall back. Creating another key in the same project does not fix that quota. No credentials are provisioned, billing changed, or secrets embedded by this branch.

## Verify

- `pnpm test` exercises real image decoding, mocked provider contracts and failures, route integration, audio cancellation/cache/fallback, and MongoDB/Blob persistence behavior.
- `pnpm exec tsc --noEmit` (Next build ignores type errors).
- `pnpm build`.
- With credentials, generate a scan and open `/trace?id=...`: inspect the research plan, actual image provider attempts, successful model and exact prompt. `POST /api/generate` returns `generation`; saved records preserve it. Failed attempts are never labeled successful Gemini generations.
- Tap headphones to hear the saved narration and see `audio tour · ElevenLabs`. With ElevenLabs absent or failing, expect `live conversation · OpenAI` and the browser microphone prompt. End the tour to stop audio and release resources.
- `pnpm scans:import`, then `GET /api/scans?limit=200`. Confirm both response `source` and `X-Scan-Store` are `mongodb`; `blob-fallback` is explicitly not a MongoDB success.

Live verification needs funded Gemini access, an ElevenLabs key/voice and Atlas URI. Automated provider tests use mocked responses and are not evidence of live provider success. This branch does not deploy or change production configuration.

API references: [Gemini generateContent](https://ai.google.dev/api/generate-content), [structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [image generation](https://ai.google.dev/gemini-api/docs/generate-content/image-generation), [ElevenLabs speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).
