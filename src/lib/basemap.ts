// Map tiles. CARTO Voyager (TimeWarp's basemap) now needs a key, so without
// NEXT_PUBLIC_CARTO_BASEMAP_API_KEY we fall back to OpenStreetMap's own tiles,
// which are keyless for light use with attribution.
const apiKey = process.env.NEXT_PUBLIC_CARTO_BASEMAP_API_KEY

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export const TILE_URL = apiKey
  ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(apiKey)}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

export const TILE_OPTIONS = {
  maxZoom: 19,
  attribution: apiKey ? `${OSM}, &copy; <a href="https://carto.com/attributions">CARTO</a>` : OSM,
}
