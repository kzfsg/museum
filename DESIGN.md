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

This is a code-derived record of the current **Persuade** landing hero, not an approved visual comp or a redesign of the application. The reference is overlay-site's light composition and outward image ribbon. The camera, review, and exploration screens retain their existing dark styling.

The hero uses warm paper, restrained dark type, generous open space, and mirrored photographs. Its distinguishing feature is matched past/present NYC imagery, with a single action leading to camera capture. Descriptive language here records the implementation; no separate creative north star has been approved.

## Colors

Paper is the hero canvas; ink supplies the wordmark, headline, and primary action. Muted supporting, caption, and era-label tones establish hierarchy. Green is reserved for keyboard focus and selection. These local hero colors do not replace the global dark palette.

## Typography

Hanken Grotesk is inherited from the app's sans-serif setup. Lowercase copy, tight tracking, and moderate headline weight keep the introduction conversational. The wordmark is compact (19px, weight 600); the CTA is 15px. The caption wraps within a 660px maximum width.

## Layout

A centered column fills at least the small viewport height. The wordmark sits above the introduction; the full-width ribbon separates the introduction from the CTA, followed by the two-line explanatory subtitle. Desktop padding is 108px above and 36px below.

At widths of 600px or less, padding becomes 96px above and 28px below, headline size becomes `clamp(32px, 8.9vw, 48px)`, and supporting type becomes `clamp(24px, 6.5vw, 32px)`. Captions reduce to 13px within 340px. The ribbon stage follows overlay-site’s 12-unit layout: one unit is 2.2vw below 640px, 1.5vw below 1024px, and min(1vw, 16px) on desktop. Above 1500px, the column adds an 8px gap.

## Elevation & Depth

Depth belongs to the image ribbon: the actual overlay-site ImageArc uses a shared perspective camera and curved WebGL surfaces, with the original center seam, square frames, fade and outward motion. The surrounding composition stays flat.

## Shapes

Photographs have gently rounded corners. The CTA is a dark pill with a matching thin border, at least 52px tall. The hero clips the ribbon at its outer edges.

## Components

**Primary action.** “travel back in time” and an up-right arrow open camera capture. Hover lightens the fill and lifts the button 2px; active returns it to rest. Keyboard focus uses a 2px outline with 5px offset. Color and position transition over 180ms with ease timing; reduced motion removes the transition.

**Time ribbon.** `ImageArc.tsx` is copied from overlay-site’s `components/image-arc.tsx`. Its geometry, shader, camera, 2.8-second emergence, center birth fade and 26-second traversal constant are retained. Integration selects matching past/current halves of generated NYC diptychs, using the same index and lap for opposite cards. Spacing uses 15% nominal overlap to expose approximately 85% of each photo; frame count adapts to the viewport. Reduced motion keeps a static arrangement; hidden/offscreen views suspend animation. The accessible description identifies the imagery as AI-generated reconstructions.

## Do's and Don'ts

- Do preserve matching landmarks, viewpoints, and phase across opposite sides.
- Do keep the hero's one CTA connected to camera capture.
- Do retain keyboard focus and the reduced-motion arrangement.
- Don't present generated reconstructions as archival photographs.
- Don't apply this light hero palette to the existing app flow without a separate decision.
- Don't treat this implementation record as an approved comp.
