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

// Initial compass bearing (0 = north, clockwise) from point 1 to point 2.
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLng = toRad(lng2 - lng1)
  const y = Math.sin(dLng) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Panoramas are stored with north at the image center (yaw 0), so a compass
// bearing maps to a horizontal position as a fraction of the image width.
export function bearingToImageFraction(bearing: number): number {
  return (((0.5 + bearing / 360) % 1) + 1) % 1
}

// `coarse` accepts a recent cached or Wi-Fi/cell fix, which works indoors
// where precise GPS often never answers.
export function getPosition(timeoutMs = 8000, coarse = false): Promise<GeolocationPosition> {
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
      coarse ? { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 } : { enableHighAccuracy: true, timeout: timeoutMs }
    )
  })
}

// What to tell the user when getPosition fails. Once a site is denied, browsers
// stop showing the prompt, so a denial needs directions to the setting.
export function locationProblem(err: unknown, secure = true): string {
  if (!secure) return 'location only works over https. open the https version of this page.'
  const code = (err as { code?: number } | null)?.code
  if (code === 1) {
    return 'location is blocked for this site, so your phone won’t ask again. on iphone: tap aA in the address bar, then website settings, and set location to allow (and check settings → privacy → location services → safari websites). then try again.'
  }
  if (code === 2) return 'your phone couldn’t work out where you are. turn on location services (and wi-fi, which helps indoors) and try again.'
  if (code === 3 || (err instanceof Error && err.message.startsWith('Timed out'))) {
    return 'finding your location timed out. step near a window or outside and try again.'
  }
  return 'this browser can’t share your location. try safari or chrome.'
}
