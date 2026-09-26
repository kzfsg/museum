// Sample NYC spots for UX testing. Only `lower-manhattan` has a panorama of the
// actual place; the others reuse TimeWarp scenes as stand-ins (`placeholder: true`).

export type TidbitKind = 'history' | 'local'

export interface Tidbit {
  id: string
  kind: TidbitKind
  title: string
  body: string
  // Where the hotspot sits in the panorama, in degrees.
  pitch: number
  yaw: number
  source?: string
}

export interface Place {
  id: string
  name: string
  neighborhood: string
  lat: number
  lng: number
  year: number
  panorama: string
  placeholder?: boolean
  startYaw?: number
  // Vertical coverage for partial panoramas (raw scans); defaults to 180.
  vaov?: number
  vOffset?: number
  tidbits: Tidbit[]
}

export const places: Place[] = [
  {
    id: 'lower-manhattan',
    name: 'West & Vesey Streets',
    neighborhood: 'Lower Manhattan',
    lat: 40.7142,
    lng: -74.0129,
    year: 2001,
    panorama: '/panoramas/08.png',
    tidbits: [
      {
        id: 'radio-row',
        kind: 'history',
        title: 'Radio Row',
        body: 'Before the towers, the blocks around Cortlandt Street were "Radio Row," a dense district of electronics shops. It was cleared in the 1960s to build the World Trade Center.',
        pitch: 0,
        yaw: 40,
      },
      {
        id: 'washington-market',
        kind: 'history',
        title: 'Washington Market',
        body: 'For over a century this stretch of the West Side was home to Washington Market, one of the city’s biggest produce markets, until it was demolished in the 1960s.',
        pitch: -5,
        yaw: -70,
      },
    ],
  },
  {
    id: 'orchard-street',
    name: 'Orchard Street',
    neighborhood: 'Lower East Side',
    lat: 40.7187,
    lng: -73.9900,
    year: 1905,
    panorama: '/panoramas/16.png',
    placeholder: true,
    tidbits: [
      {
        id: '97-orchard',
        kind: 'history',
        title: '97 Orchard Street',
        body: 'Built in 1863, this tenement was home to thousands of immigrants from more than 20 countries. It is now the Tenement Museum.',
        pitch: 0,
        yaw: 20,
      },
      {
        id: 'pushcarts',
        kind: 'local',
        title: 'Pushcart market',
        body: 'Orchard Street was once lined with pushcart vendors. Some shops on the block are still family-run a century later.',
        pitch: -10,
        yaw: 150,
      },
    ],
  },
  {
    id: 'seaport',
    name: 'South Street',
    neighborhood: 'South Street Seaport',
    lat: 40.7066,
    lng: -74.0036,
    year: 1850,
    panorama: '/panoramas/31.png',
    placeholder: true,
    tidbits: [
      {
        id: 'fish-market',
        kind: 'history',
        title: 'Fulton Fish Market',
        body: 'The fish market operated on South Street from 1822 until it moved to Hunts Point in the Bronx in 2005.',
        pitch: -5,
        yaw: -30,
      },
      {
        id: 'schermerhorn',
        kind: 'history',
        title: 'Schermerhorn Row',
        body: 'The row of brick warehouses on Fulton Street dates to 1811–12, among the oldest buildings in Manhattan.',
        pitch: 5,
        yaw: 90,
      },
    ],
  },
  {
    id: 'red-hook',
    name: 'Van Brunt Street',
    neighborhood: 'Red Hook, Brooklyn',
    lat: 40.6785,
    lng: -74.0120,
    year: 1939,
    panorama: '/panoramas/42.png',
    placeholder: true,
    tidbits: [
      {
        id: 'waterfront',
        kind: 'history',
        title: 'Working waterfront',
        body: 'Red Hook’s piers were among the busiest in the port for much of the 20th century.',
        pitch: 0,
        yaw: 0,
      },
      {
        id: 'ball-fields',
        kind: 'local',
        title: 'Ball field vendors',
        body: 'On summer weekends, Latin American food vendors have set up by the Red Hook ball fields for decades.',
        pitch: -8,
        yaw: 120,
      },
    ],
  },
]
