# Museum

Turn any NYC block into a museum (DivHacks, "Know Your City" track). Point your phone around a
360° panorama of the block's past; history and local-culture tidbits are pinned as hotspots.

Built on the TimeWarp codebase (kzfsg/timewarp-submission): the Pannellum viewer, theme, and
Next.js shell are reused; the guessing game, multiplayer server, and leaderboard were removed.
The current UI is a bare testing scaffold and will be redesigned.

## Commands

```bash
pnpm dev     # Next.js dev server
pnpm build
pnpm test    # vitest unit tests (src/**/*.test.ts)
```

Env: `OPENAI_API_KEY` (image generation; optional `OPENAI_IMAGE_MODEL`), `BLOB_READ_WRITE_TOKEN`
(private Vercel Blob store `museum-scans`). The voice guide uses `OPENAI_API_KEY` too (optional
`OPENAI_GUIDE_MODEL`, `OPENAI_GUIDE_BACKEND_MODEL`, `OPENAI_GUIDE_VOICE`). Without either, the app still runs with that feature off.

## Layout

- `app/page.tsx` — state machine: `splash -> capture -> review -> explore`, plus `pick` (saved scans
  and sample spots). Location is fetched in the background during capture.
- `src/components/Capture.tsx` — camera + compass; auto-captures a frame every 30° (tap to capture
  without a compass). Shows a banner when a saved scan exists nearby. Speed/tilt gating and the
  on-screen guidance live in `src/lib/captureGuide.ts`.
- `src/lib/motion.ts` — `OrientationTracker` fuses fast gyro heading with the (laggy) iOS compass,
  which only corrects north once the phone has been still for a moment.
- `src/lib/fov.ts` — measures the camera's FOV per scan by matching neighbouring frames (phones
  deliver 4:3 or 16:9 streams, so it can't be assumed); falls back to an aspect-based guess.
- `src/lib/stitch.ts` — pastes frames onto an equirectangular canvas by heading. North is the image
  center, so panorama yaw == compass heading everywhere (stitch, tidbits, viewer).
- `app/api/generate/route.ts` — history lookup -> grounded prompt -> OpenAI image edit -> save.
- `src/lib/history.ts` — Wikipedia geosearch + NYC PLUTO construction years; turns them into tidbits.
- `src/lib/prompt.ts` — tells the model which buildings did/didn't exist yet, by image position.
- `src/lib/scanStore.ts`, `app/api/scans/*` — scans saved as image + JSON sidecar in private Blob;
  lat/lng/year are encoded in the pathname so nearby lookup is one `list()`. Images are served
  through `/api/scans/image`.
- `src/components/PanoramaViewer.tsx` — Pannellum (CDN). `motion` steers by compass with smoothing
  (falls back to relative tracking), `yawOffset` is the manual "line it up" correction. `haov/vaov`
  are explicit so the model's 3:2 output wraps the full sphere without resizing.
- Voice tour guide (GPT-Live over WebRTC): `app/api/guide/route.ts` creates the session server-side
  (key stays there; lookups are delegated to a text model with web search), `src/lib/liveGuide.ts`
  is the browser connection, `src/lib/guide.ts` builds the instructions and describes the view in
  words (GPT-Live takes no images), `src/components/useTourGuide.ts` feeds it the viewer's yaw.
- Sounds of the past: `app/api/soundscape/route.ts` has a vision model (optional `OPENAI_SOUND_MODEL`)
  pick layers from the CC0 recordings in `public/sounds` (credits in `CREDITS.md`); the year and
  indoor/outdoor rules in `src/lib/soundscape.ts` are enforced on its pick, with an era mix as fallback.
  `src/lib/soundscapePlayer.ts` mixes them with Web Audio on one shared AudioContext (`src/lib/audio.ts`)
  that the first tap unlocks, so each scene's sound starts as soon as it opens, independent of the guide.
- `src/data/places.ts` — sample spots; `placeholder: true` panoramas are not the actual place.
- TypeScript errors are ignored by `next build`; run `pnpm exec tsc --noEmit` to check.

## The component map (Olympus)

This repo is indexed into a component map derived from the compiler, not from guesses.
Prefer it over grepping when you need to know where something lives or what depends on what.

- `olympus_map` — the components and the links between them. Start here to orient.
  Pass `focus` with a block id or name plus `depth` to see one neighbourhood.
- `olympus_entries` — for one component, the symbols other components call, with
  `path:line`. This is the "what crosses this boundary" question.
- `olympus_propose` — draw a component or a link that SHOULD exist but does not yet.
  It records an intention; it never asserts the code is there.
- `olympus_highlight` — dim the user's map to the components you are talking about.
  Use it whenever an answer names specific components; it is a gesture at their
  screen, cleared by their next click.

Blocks are `solid` when the compiler found them and `dashed` when someone only asserted
them. Anything you propose stays dashed until real code exists and the next index finds it,
so build the code as well as the proposal.

The map is a snapshot written by the IDE. If it looks stale, say so rather than working
around it.
<!-- intuition:olympus:end -->
