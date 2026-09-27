'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapScreen } from '@/src/components/MapScreen'
import { Explore } from '@/src/components/Explore'
import type { ScanWithUrl } from '@/app/api/scans/route'

export default function SavedMapPage() {
  const router = useRouter()
  const [scan, setScan] = useState<ScanWithUrl | null>(null)
  if (scan) return <Explore key={scan.id} place={{
    id: `scan-${scan.id}`, name: 'saved panorama',
    neighborhood: `scanned ${new Date(scan.createdAt).toLocaleDateString()}`,
    lat: scan.lat, lng: scan.lng, year: scan.year, panorama: scan.imageUrl,
    present: scan.presentUrl, startYaw: scan.startYaw, tidbits: scan.tidbits, note: scan.note,
  }} onBack={() => setScan(null)} onPickScan={setScan} />
  return <MapScreen onPick={setScan} onBack={() => router.push('/')} backLabel="back home" />
}
