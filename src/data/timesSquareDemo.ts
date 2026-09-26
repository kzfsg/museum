import type { Place } from './places'

// Bundled demo: opens without camera/location permissions, generation, or Blob storage.
// Both images are illustrative AI-generated panoramas with matching viewpoints.
export const timesSquareDemo: Place = {
  id: 'demo-times-square',
  name: 'Times Square',
  neighborhood: 'Midtown Manhattan',
  lat: 40.7580,
  lng: -73.9855,
  year: 1927,
  panorama: '/panoramas/demo/times-square-1927.jpg',
  present: '/panoramas/demo/times-square-present.jpg',
  startYaw: 0,
  vaov: 180,
  note: 'demo · AI-imagined Times Square, then and now. Drag to explore, or compare with today.',
  tidbits: [
    {
      id: 'times-square-ball',
      kind: 'history',
      title: 'The first ball drop',
      body: 'The first New Year’s Eve ball descended from the flagpole atop One Times Square in 1907. Crowds had already been gathering here to celebrate since 1904.',
      pitch: 24,
      yaw: -4,
      source: 'https://www.timessquarenyc.org/nye/nye-history-times-square-ball',
    },
    {
      id: 'times-square-subway',
      kind: 'history',
      title: 'The city arrives underground',
      body: 'The Times Square subway station served almost five million passengers in 1905, its first full year of operation. The new subway helped bring the city to this growing entertainment district.',
      pitch: -12,
      yaw: 35,
      source: 'https://www.timessquarenyc.org/times-square-alliance/history',
    },
  ],
}
