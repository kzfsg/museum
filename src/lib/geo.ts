import type { Place } from '@/src/data/places'

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function nearestPlace(places: Place[], lat: number, lng: number) {
  let best: { place: Place; km: number } | null = null
  for (const place of places) {
    const km = haversineKm(lat, lng, place.lat, place.lng)
    if (!best || km < best.km) best = { place, km }
  }
  return best
}

export function getPosition(timeoutMs = 8000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser'))
      return
    }
    // The API's own `timeout` doesn't start until permission is granted, so an
    // unanswered permission prompt would hang forever without this.
    const timer = setTimeout(() => reject(new Error('Timed out getting location')), timeoutMs + 2000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer)
        resolve(pos)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
      { enableHighAccuracy: true, timeout: timeoutMs }
    )
  })
}
