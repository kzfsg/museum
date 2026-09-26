---
name: Time Machine — landing hero
description: Light NYC time-travel introduction with a paired photographic ribbon.
colors:
  paper: "#fafaf7"
  ink: "#20211e"
  supporting: "#696b63"
  caption: "#676960"
  era-label: "#6b6d65"
  hover-ink: "#41443b"
  focus: "#42644c"
  selection: "#d6dfcf"
  paper-sunk: "#efefe8"
typography:
  display:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "clamp(38px, 4.9vw, 70px)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "clamp(24px, 3.1vw, 44px)"
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontSize: "12px"
    letterSpacing: "0.06em"
rounded:
  pill: "100px"
spacing:
  small: "8px"
  medium: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.hover-ink}"
---

# Design System: Time Machine landing hero

## Overview

This is a code-derived record of the current **Persuade** landing hero, not an approved visual comp or a redesign of the application. The reference is overlay-site's light composition and outward image ribbon. The camera, review, and exploration screens carry the same world as paper chrome over full-bleed imagery (see App chrome).

The hero uses warm paper, restrained dark type, generous open space, and mirrored photographs. Its distinguishing feature is matched past/present NYC imagery, with a single action leading to camera capture. Descriptive language here records the implementation; no separate creative north star has been approved.

## Colors

Paper is the hero canvas; ink supplies the wordmark, headline, and primary action. Muted supporting, caption, and era-label tones establish hierarchy. Green is reserved for keyboard focus and selection. These local hero colors do not replace the global dark palette.

## Typography

Hanken Grotesk is inherited from the app's sans-serif setup. Lowercase copy, tight tracking, and moderate headline weight keep the introduction conversational. The wordmark is compact (19px, weight 600); the CTA is 15px. The caption wraps within a 660px maximum width.

## Layout

A centered column fills at least the small viewport height. The wordmark sits above the introduction; the full-width ribbon separates the introduction from the CTA, followed by the two-line explanatory subtitle. Desktop padding is 108px above and 36px below.

At widths of 600px or less, padding becomes 96px above and 28px below, headline size becomes `clamp(32px, 8.9vw, 48px)`, and supporting type becomes `clamp(24px, 6.5vw, 32px)`. Captions reduce to 13px within 340px. The ribbon stage follows overlay-site’s 12-unit layout: one unit is 2.2vw below 640px, 1.5vw below 1024px, and min(1vw, 16px) on desktop. Above 1500px, the column adds an 8px gap.

## Elevation & Depth

Depth belongs to the image ribbon: the actual overlay-site ImageArc uses a shared perspective camera and curved WebGL surfaces, with the original center seam, spacing, square frames, fade and outward motion. The surrounding composition stays flat.

## Shapes

Photographs have gently rounded corners. The CTA is a dark pill with a matching thin border, at least 52px tall. The hero clips the ribbon at its outer edges.

## Components

**Primary action.** “travel back in time” and an up-right arrow open camera capture. Hover lightens the fill and lifts the button 2px; active returns it to rest. Keyboard focus uses a 2px outline with 5px offset. Color and position transition over 180ms with ease timing; reduced motion removes the transition.

**Time ribbon.** `ImageArc.tsx` is copied from overlay-site’s `components/image-arc.tsx`. Its geometry, shader, camera, 2.8-second emergence, center birth fade and 26-second traversal constant are retained. Integration selects matching past/current halves of generated NYC diptychs, using the same index and lap for opposite cards. Frame count adapts to the viewport. `PHOTO_SPACING` in ImageArc controls density independently of the original path: 1 is original density; 1.8 spreads cards farther apart after they leave the center. The original birth cadence and dense center are retained to prevent empty gaps. The refresh-reset directive remounts the WebGL scene on saved edits. Reduced motion keeps a static arrangement; hidden/offscreen views suspend animation. The accessible description identifies the imagery as AI-generated reconstructions.

## App chrome

The camera, review, and explore screens float the hero's paper and ink over full-bleed camera and panorama imagery (`src/components/chrome.module.css`). The imagery is the surface; chrome is opaque paper pills and sheets with a soft offset shadow for lift, never glass or blur. There is no grain, vignette, serif, or copper: the past-ness comes from the generated image itself.

- **Bare text and logo.** Top bars (wordmark, counters, titles, back/close icons) and plain messages (capture guidance, hints, the site note) carry no bubble and no fade: paper-white text and icons with a soft ink shadow, directly on the imagery.
- **Pills are for controls only.** 40px tall, pill radius, paper fill, hairline border, 14px lowercase copy. A pill carrying a sentence wraps (22px radius) instead of overflowing.
- **One ink action per screen.** The hero CTA: ink fill, 52px, 15px, arrow icon ("see it in 1920", "capture"). Toggled-on controls (motion) also turn ink.
- **Sheets.** Paper, 28px radius, rising 14px with an exponential ease-out on entry. The review sheet holds notices, a year scrubber (1600 to 2000: the year at 44px/500 above a hairline-ticked track, a tick every 10 years and a longer one every 50, century labels that jump to that year, and an ink thumb ringed in paper), and the CTA. Tidbits open in the same sheet over a 32% ink scrim; the title is 26px/500 in normal case, with kind and source in a caption line below the text, never as an eyebrow above it.
- **Capture guidance.** Bare text normally; an ink pill only for warnings (slow down, tilt). Progress is twelve dots on a paper disc, ink when captured, with an ink hand.
- **Notes and hints.** Bare ink text with a supporting-tone icon; hints are 13px.
- **Markers.** Pannellum hotspots are 30px paper dots with an ink center; tooltips are paper pills.
- **Type steps** in the app: 12 (meta), 13 (captions, hints), 14 (pills, body in notices), 15 (CTA, guidance, note), 16 (titles, list items), 26 (sheet title), 44 (scrubber year).
- **Voice.** Lowercase for app-authored copy; proper names (places, tidbit titles, sources) keep their capitalization.

## Do's and Don'ts

- Do preserve matching landmarks, viewpoints, and phase across opposite sides.
- Do keep the hero's one CTA connected to camera capture.
- Do retain keyboard focus and the reduced-motion arrangement.
- Don't present generated reconstructions as archival photographs.
- Do keep app chrome opaque paper over imagery; the imagery stays edge to edge.
- Don't treat this implementation record as an approved comp.
