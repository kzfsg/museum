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
```

## Layout

- `app/page.tsx` — state machine: `splash -> locating -> pick | explore`
- `src/data/places.ts` — spots, panoramas, and tidbits (hotspot pitch/yaw). Entries with
  `placeholder: true` reuse TimeWarp panoramas that are not the actual place.
- `src/components/PanoramaViewer.tsx` — Pannellum (CDN) with hotspots and device-orientation `motion`
- `src/components/Explore.tsx` — viewer HUD, motion toggle (handles iOS permission), tidbit sheet
- `src/lib/geo.ts` — geolocation with a hard timeout, nearest-place lookup
- TypeScript errors are ignored by `next build`; run `pnpm exec tsc --noEmit` to check.

<!-- intuition:olympus:start -->
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
