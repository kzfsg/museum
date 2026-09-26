import { haversineKm } from '@/src/lib/geo'

// Scans this close together share one map dot; at street zoom their dots
// would otherwise sit on top of each other and only the top one is tappable.
export const GROUP_RADIUS_M = 20

export interface ScanGroup<T> {
  lat: number
  lng: number
  // Newest first, as given.
  scans: T[]
}

// Greedy grouping: each scan joins the first group whose anchor (its newest
// scan) is within `radiusM`. Input order is kept, so pass scans newest first.
export function groupScans<T extends { lat: number; lng: number }>(scans: T[], radiusM = GROUP_RADIUS_M): ScanGroup<T>[] {
  const groups: ScanGroup<T>[] = []
  for (const scan of scans) {
    const group = groups.find((g) => haversineKm(g.lat, g.lng, scan.lat, scan.lng) * 1000 <= radiusM)
    if (group) group.scans.push(scan)
    else groups.push({ lat: scan.lat, lng: scan.lng, scans: [scan] })
  }
  return groups
}
