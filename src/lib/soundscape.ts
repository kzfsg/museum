// How a scene sounds: a mix of CC0 recordings in public/sounds (see CREDITS.md).
// A model looks at the generated scene and picks layers; the year rules here
// are enforced on whatever it picks, so a 1850 street never gets a car.

export type LayerKind = 'bed' | 'accent'

export interface Layer {
  label: string
  // Beds loop continuously; accents play now and then (a bell, a passing train).
  kind: LayerKind
  // Years in which this sound could be heard in New York.
  from: number
  to: number
  // Only for indoor scenes (true), only outdoor (false), or either (undefined).
  indoor?: boolean
  // Accents: seconds between plays, and how long each play lasts.
  every?: [number, number]
  seconds?: number
}

export const LAYERS = {
  'hooves': { label: 'hooves on the street', kind: 'bed', from: 1640, to: 1925, indoor: false },
  'wagon': { label: 'a horse-drawn wagon', kind: 'accent', from: 1680, to: 1925, indoor: false, every: [20, 50], seconds: 16 },
  'street-1920s': { label: 'a busy early-motor street', kind: 'bed', from: 1915, to: 1955, indoor: false },
  'trolley': { label: 'a trolley passing', kind: 'accent', from: 1890, to: 1956, indoor: false, every: [30, 80], seconds: 18 },
  'old-car': { label: 'an early automobile', kind: 'accent', from: 1905, to: 1965, indoor: false, every: [20, 60], seconds: 14 },
  'elevated-train': { label: 'an elevated train overhead', kind: 'accent', from: 1868, to: 2000, indoor: false, every: [60, 150], seconds: 20 },
  'steam-train': { label: 'a distant steam train', kind: 'accent', from: 1832, to: 1950, indoor: false, every: [90, 200], seconds: 20 },
  'traffic-modern': { label: 'modern traffic', kind: 'bed', from: 1960, to: 2000, indoor: false },
  'crowd': { label: 'a crowd talking', kind: 'bed', from: 1600, to: 2000 },
  'birds': { label: 'birdsong', kind: 'bed', from: 1600, to: 2000, indoor: false },
  'wind-grass': { label: 'wind through the grass', kind: 'bed', from: 1600, to: 2000, indoor: false },
  'harbor': { label: 'the harbor and gulls', kind: 'bed', from: 1600, to: 2000, indoor: false },
  'ship-horn': { label: 'a ship’s horn', kind: 'accent', from: 1840, to: 2000, indoor: false, every: [70, 180], seconds: 8 },
  'church-bell': { label: 'a church bell', kind: 'accent', from: 1640, to: 2000, every: [120, 300], seconds: 10 },
  'construction': { label: 'hammering', kind: 'accent', from: 1600, to: 2000, every: [25, 70], seconds: 10 },
  'farm': { label: 'chickens and a rooster', kind: 'bed', from: 1600, to: 1900, indoor: false },
  'stream': { label: 'a running stream', kind: 'bed', from: 1600, to: 1860, indoor: false },
  'room-tone': { label: 'a quiet room', kind: 'bed', from: 1600, to: 2000, indoor: true },
  'diner': { label: 'diner chatter', kind: 'bed', from: 1930, to: 2000, indoor: true },
} satisfies Record<string, Layer>

export type LayerId = keyof typeof LAYERS
export const LAYER_IDS = Object.keys(LAYERS) as LayerId[]

export function layerUrl(id: LayerId): string {
  return `/sounds/${id}.mp3`
}

export interface MixLayer {
  id: LayerId
  // 0..1
  volume: number
}

export interface SoundscapeMix {
  layers: MixLayer[]
  // A few words on what you're hearing, e.g. "hooves, a trolley, a crowd".
  caption: string
  indoor: boolean
}

export const MAX_LAYERS = 5
const MIN_YEAR = 1600
const MAX_YEAR = 2000

// Scans can be of today; sound them as the latest year the library covers.
function soundYear(year: number): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, Math.round(year)))
}

export function layerFits(id: LayerId, year: number, indoor: boolean): boolean {
  const layer: Layer = LAYERS[id]
  const y = soundYear(year)
  return y >= layer.from && y <= layer.to && (layer.indoor === undefined || layer.indoor === indoor)
}

export function allowedLayers(year: number, indoor: boolean): LayerId[] {
  return LAYER_IDS.filter((id) => layerFits(id, year, indoor))
}

function captionFor(layers: MixLayer[]): string {
  const labels = [...layers].sort((a, b) => b.volume - a.volume).map((l) => LAYERS[l.id].label)
  return labels.join(', ')
}

// Used without a model, or when it fails: a typical mix for the era.
export function fallbackMix(year: number, indoor = false): SoundscapeMix {
  const y = soundYear(year)
  let picks: [LayerId, number][]
  if (indoor) picks = y >= 1930 ? [['diner', 0.6], ['room-tone', 0.4]] : [['room-tone', 0.6], ['crowd', 0.25], ['church-bell', 0.3]]
  else if (y < 1800) picks = [['wind-grass', 0.5], ['birds', 0.6], ['farm', 0.35], ['church-bell', 0.3]]
  else if (y < 1870) picks = [['hooves', 0.6], ['crowd', 0.45], ['wagon', 0.5], ['church-bell', 0.3]]
  else if (y < 1915) picks = [['hooves', 0.6], ['crowd', 0.45], ['trolley', 0.5], ['elevated-train', 0.45]]
  else if (y < 1956) picks = [['street-1920s', 0.6], ['crowd', 0.35], ['old-car', 0.45], ['trolley', 0.4]]
  else picks = [['traffic-modern', 0.6], ['crowd', 0.35], ['elevated-train', 0.35]]
  const layers = picks.map(([id, volume]) => ({ id, volume }))
  return { layers, caption: captionFor(layers), indoor }
}

// Keeps a model's pick to known, era-appropriate layers; falls back if nothing survives.
export function sanitizeMix(raw: unknown, year: number): SoundscapeMix {
  const r = (raw ?? {}) as { layers?: unknown; caption?: unknown; indoor?: unknown }
  const indoor = r.indoor === true
  const seen = new Set<LayerId>()
  const layers: MixLayer[] = []
  for (const item of Array.isArray(r.layers) ? r.layers : []) {
    const { id, volume } = (item ?? {}) as { id?: unknown; volume?: unknown }
    if (typeof id !== 'string' || !(id in LAYERS)) continue
    const layerId = id as LayerId
    if (seen.has(layerId) || !layerFits(layerId, year, indoor)) continue
    const v = typeof volume === 'number' && Number.isFinite(volume) ? Math.min(1, Math.max(0.05, volume)) : 0.5
    seen.add(layerId)
    layers.push({ id: layerId, volume: v })
    if (layers.length === MAX_LAYERS) break
  }
  if (!layers.length) return fallbackMix(year, indoor)
  // Accents alone would leave silence between them, so borrow the era's beds.
  if (!layers.some((l) => LAYERS[l.id].kind === 'bed')) {
    const beds = fallbackMix(year, indoor).layers.filter((l) => LAYERS[l.id].kind === 'bed')
    const merged = [...beds, ...layers].slice(0, MAX_LAYERS)
    return { layers: merged, caption: captionFor(merged), indoor }
  }
  const caption = typeof r.caption === 'string' && r.caption.trim() ? r.caption.trim().slice(0, 120) : captionFor(layers)
  return { layers, caption, indoor }
}
