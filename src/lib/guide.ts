// The voice tour guide's knowledge: what the scene is, and what's in front of
// the visitor right now. GPT-Live takes no images, so the view is described in
// words from the viewer's yaw and the tidbits' positions (panorama yaw ==
// compass heading, see stitch.ts).

import type { Place, Tidbit } from '@/src/data/places'
import { angleDiff } from '@/src/lib/motion'

// What the guide is told about the scene when the session starts.
export interface GuideScene {
  name: string
  neighborhood: string
  year: number
  note?: string | null
  placeholder?: boolean
  tidbits: Pick<Tidbit, 'title' | 'body' | 'yaw' | 'source' | 'narration' | 'narrationProvider'>[]
}

// Keeps the startup instructions well inside the model's limits.
const MAX_TIDBITS = 8
const MAX_BODY_CHARS = 600
// A tidbit this close to the center of the view counts as "right in front".
const AHEAD_DEG = 15
// Turning at least this far gets a fresh description of the view.
export const TURN_DEG = 30

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']

export function compassWord(yaw: number): string {
  const i = Math.round((((yaw % 360) + 360) % 360) / 45) % 8
  return COMPASS[i]
}

export function sceneFromPlace(place: Place): GuideScene {
  return {
    name: place.name,
    neighborhood: place.neighborhood,
    year: place.year,
    note: place.note,
    placeholder: place.placeholder,
    tidbits: place.tidbits.slice(0, MAX_TIDBITS).map((t) => ({
      title: t.title,
      body: t.body.slice(0, MAX_BODY_CHARS),
      yaw: t.yaw,
      source: t.source,
      narration: t.narration,
      narrationProvider: t.narrationProvider,
    })),
  }
}

export function guideInstructions(scene: GuideScene): string {
  const facts = scene.tidbits.length
    ? scene.tidbits
        .map((t) => `- ${t.title} (to the ${compassWord(t.yaw)}): ${t.body}${t.source ? ` [source: ${t.source}]` : ''}`)
        .join('\n')
    : '- No local history was found for this spot.'
  return [
    `You are a friendly, knowledgeable walking-tour guide in New York City, speaking to a visitor through their phone.`,
    `The visitor is standing at ${scene.name} (${scene.neighborhood}) and looking around a 360° reconstruction of how it looked in ${scene.year}.`,
    `The picture is an AI reconstruction, not an archival photo; say so if they ask whether it's real.`,
    scene.placeholder ? `This panorama is a stand-in image, not the actual place.` : '',
    scene.note ? `Note about this view: ${scene.note}` : '',
    ``,
    `What's known about this spot:`,
    facts,
    ``,
    `You'll get updates saying which way the visitor is facing and what's in front of them. Talk about what they're looking at, as a guide standing beside them would ("the building on your left", "just ahead").`,
    `Keep turns short: one to three sentences, then let them react. Speak casually, no lists.`,
    `Stick to the facts above and what you can look up. If you don't know something, say so rather than guessing, and never invent dates, names, or events.`,
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export interface ViewSummary {
  facing: string
  // Titles of tidbits within view, nearest the center first.
  inView: string[]
  // The one nearly dead ahead, if any.
  ahead: string | null
}

export function summarizeView(scene: GuideScene, yaw: number, hfov: number): ViewSummary {
  const visible = scene.tidbits
    .map((t) => ({ title: t.title, off: Math.abs(angleDiff(yaw, t.yaw)) }))
    .filter((t) => t.off <= hfov / 2)
    .sort((a, b) => a.off - b.off)
  return {
    facing: compassWord(yaw),
    inView: visible.map((t) => t.title),
    ahead: visible[0] && visible[0].off <= AHEAD_DEG ? visible[0].title : null,
  }
}

// What the guide was last told about the view.
export interface ViewTracker {
  yaw: number | null
  ahead: string | null
  // Landmarks the guide has already been asked to talk about.
  mentioned: Set<string>
}

export function newViewTracker(): ViewTracker {
  return { yaw: null, ahead: null, mentioned: new Set() }
}

export interface ViewUpdate {
  text: string
  // Ask the guide to talk now (a landmark it hasn't covered came into view).
  speak: boolean
}

// Call with a settled view; returns what to tell the guide, if anything.
// Small turns are ignored, a new landmark straight ahead gets narrated once,
// and anything else is passed along quietly.
export function viewUpdate(tracker: ViewTracker, scene: GuideScene, yaw: number, hfov: number): ViewUpdate | null {
  const view = summarizeView(scene, yaw, hfov)
  const turned = tracker.yaw === null || Math.abs(angleDiff(yaw, tracker.yaw)) >= TURN_DEG
  if (!turned && view.ahead === tracker.ahead) return null
  tracker.yaw = yaw
  tracker.ahead = view.ahead
  const fresh = view.ahead !== null && !tracker.mentioned.has(view.ahead)
  if (fresh) {
    tracker.mentioned.add(view.ahead!)
    return { text: `${describeView(view)} If they aren't mid-conversation, briefly tell them about ${view.ahead}.`, speak: true }
  }
  return { text: describeView(view), speak: false }
}

export function describeView(view: ViewSummary): string {
  const parts = [`The visitor is now facing ${view.facing}.`]
  if (view.ahead) parts.push(`Right in front of them: ${view.ahead}.`)
  const others = view.inView.filter((t) => t !== view.ahead)
  if (others.length) parts.push(`Also in view: ${others.join('; ')}.`)
  if (!view.inView.length) parts.push(`None of the known landmarks are in view.`)
  return parts.join(' ')
}
