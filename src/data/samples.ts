import type { Place } from './places'
import { timesSquareDemo } from './timesSquareDemo'

// Pinned cached scans: independent of location, generation, and Blob availability.
const cached: Place[] = [
  {
    "id": "sample-columbia-university",
    "name": "Columbia University",
    "neighborhood": "cached panorama",
    "lat": 40.80714727624716,
    "lng": -73.96393851881676,
    "year": 2000,
    "panorama": "/panoramas/demo/columbia-university-past.jpg",
    "present": "/panoramas/demo/columbia-university-present.jpg",
    "startYaw": 48.59644146382709,
    "note": null,
    "tidbits": [
      {
        "id": "bldg-552 WEST 114 STREET",
        "kind": "local",
        "title": "Standing since 1900",
        "body": "City records list 552 West 114 Street as built in 1900, 5 floors. It's one of the oldest buildings around you.",
        "pitch": 0,
        "yaw": -165.02045879600774,
        "source": "NYC Department of City Planning, PLUTO"
      },
      {
        "id": "bldg-554 WEST 114 STREET",
        "kind": "local",
        "title": "Standing since 1900",
        "body": "City records list 554 West 114 Street as built in 1900, 5 floors. It's one of the oldest buildings around you.",
        "pitch": 8,
        "yaw": -161.94044346496975,
        "source": "NYC Department of City Planning, PLUTO"
      },
      {
        "id": "wiki-Carman Hall",
        "kind": "history",
        "title": "Carman Hall",
        "body": "Carman Hall is a dormitory located on Columbia University's Morningside Heights campus and currently houses first-year students from Columbia College as well as the Fu Foundation School of Engineering and Applied Science.",
        "pitch": 16,
        "yaw": -160.23555733319267,
        "source": "https://en.wikipedia.org/wiki/Carman_Hall"
      },
      {
        "id": "wiki-Furnald Hall",
        "kind": "history",
        "title": "Furnald Hall",
        "body": "Furnald Hall is a dormitory located on Columbia University's Morningside Heights campus and currently houses first-year students from Columbia College as well as the Fu Foundation School of Engineering and Applied Science. It is dedicated in memory of Royal Blacker Furnald, of the Columbia College Class of 1901.",
        "pitch": 0,
        "yaw": 6.078996638166359,
        "source": "https://en.wikipedia.org/wiki/Furnald_Hall"
      },
      {
        "id": "wiki-Statue of Thomas Jefferson (Columbia University)",
        "kind": "history",
        "title": "Statue of Thomas Jefferson (Columbia University)",
        "body": "An outdoor sculpture of Thomas Jefferson by William Ordway Partridge is installed outside the School of Journalism on the Columbia University campus in Manhattan, New York, United States. It was modeled in plaster in 1901 and cast in bronze in 1914 by the New York–based foundry Roman Bronze Works.",
        "pitch": 0,
        "yaw": 40.05918522082146,
        "source": "https://en.wikipedia.org/wiki/Statue_of_Thomas_Jefferson_(Columbia_University)"
      },
      {
        "id": "wiki-Columbia University Graduate School of Journalism",
        "kind": "history",
        "title": "Columbia University Graduate School of Journalism",
        "body": "The Columbia University Graduate School of Journalism is the journalism school of Columbia University, located in the Morningside Heights neighborhood of Manhattan, New York City, United States.    \nAdmissions to the school are highly selective; traditionally drawing upon an international student body. Alumni have gone...",
        "pitch": 0,
        "yaw": 52.403022991184514,
        "source": "https://en.wikipedia.org/wiki/Columbia_University_Graduate_School_of_Journalism"
      },
      {
        "id": "wiki-Alfred Lerner Hall",
        "kind": "history",
        "title": "Alfred Lerner Hall",
        "body": "Alfred Lerner Hall is the student center or students' union of Columbia University. It is named for Al Lerner, who financed part of its construction. Situated on the university's historic Morningside Heights campus in New York City, the building, designed by deconstructivist architect Bernard Tschumi, then dean of Columbia...",
        "pitch": 0,
        "yaw": 179.64859417192815,
        "source": "https://en.wikipedia.org/wiki/Alfred_Lerner_Hall"
      }
    ]
  },
  {
    "id": "sample-lerner-hall",
    "name": "Within Lerner Hall",
    "neighborhood": "cached panorama",
    "lat": 40.80722816637536,
    "lng": -73.96422313966762,
    "year": 1920,
    "panorama": "/panoramas/demo/lerner-hall-past.jpg",
    "present": "/panoramas/demo/lerner-hall-present.jpg",
    "startYaw": 149.18087879205353,
    "note": "this building opened in 1999. here's the site in 1920.",
    "tidbits": [
      {
        "id": "bldg-552 WEST 114 STREET",
        "kind": "local",
        "title": "Standing since 1900",
        "body": "City records list 552 West 114 Street as built in 1900, 5 floors. It's one of the oldest buildings around you.",
        "pitch": 0,
        "yaw": -178.0800943864677,
        "source": "NYC Department of City Planning, PLUTO"
      },
      {
        "id": "bldg-554 WEST 114 STREET",
        "kind": "local",
        "title": "Standing since 1900",
        "body": "City records list 554 West 114 Street as built in 1900, 5 floors. It's one of the oldest buildings around you.",
        "pitch": 8,
        "yaw": -175.34718394651838,
        "source": "NYC Department of City Planning, PLUTO"
      },
      {
        "id": "wiki-Furnald Hall",
        "kind": "history",
        "title": "Furnald Hall",
        "body": "Furnald Hall is a dormitory located on Columbia University's Morningside Heights campus and currently houses first-year students from Columbia College as well as the Fu Foundation School of Engineering and Applied Science. It is dedicated in memory of Royal Blacker Furnald, of the Columbia College Class of 1901.",
        "pitch": 0,
        "yaw": 42.94440882570109,
        "source": "https://en.wikipedia.org/wiki/Furnald_Hall"
      },
      {
        "id": "wiki-Statue of Thomas Jefferson (Columbia University)",
        "kind": "history",
        "title": "Statue of Thomas Jefferson (Columbia University)",
        "body": "An outdoor sculpture of Thomas Jefferson by William Ordway Partridge is installed outside the School of Journalism on the Columbia University campus in Manhattan, New York, United States. It was modeled in plaster in 1901 and cast in bronze in 1914 by the New York–based foundry Roman Bronze Works.",
        "pitch": 0,
        "yaw": 63.58240004007564,
        "source": "https://en.wikipedia.org/wiki/Statue_of_Thomas_Jefferson_(Columbia_University)"
      },
      {
        "id": "wiki-Columbia University Graduate School of Journalism",
        "kind": "history",
        "title": "Columbia University Graduate School of Journalism",
        "body": "The Columbia University Graduate School of Journalism is the journalism school of Columbia University, located in the Morningside Heights neighborhood of Manhattan, New York City, United States.    \nAdmissions to the school are highly selective; traditionally drawing upon an international student body. Alumni have gone...",
        "pitch": 8,
        "yaw": 68.02024643565147,
        "source": "https://en.wikipedia.org/wiki/Columbia_University_Graduate_School_of_Journalism"
      },
      {
        "id": "wiki-Alfred Lerner Hall",
        "kind": "history",
        "title": "Alfred Lerner Hall",
        "body": "Alfred Lerner Hall is the student center or students' union of Columbia University. It is named for Al Lerner, who financed part of its construction. Situated on the university's historic Morningside Heights campus in New York City, the building, designed by deconstructivist architect Bernard Tschumi, then dean of Columbia...",
        "pitch": 0,
        "yaw": 150.12249159327973,
        "source": "https://en.wikipedia.org/wiki/Alfred_Lerner_Hall"
      },
      {
        "id": "wiki-Carman Hall",
        "kind": "history",
        "title": "Carman Hall",
        "body": "Carman Hall is a dormitory located on Columbia University's Morningside Heights campus and currently houses first-year students from Columbia College as well as the Fu Foundation School of Engineering and Applied Science.",
        "pitch": 0,
        "yaw": 175.64685073943463,
        "source": "https://en.wikipedia.org/wiki/Carman_Hall"
      }
    ]
  },
  {
    "id": "sample-singapore",
    "name": "Singapore",
    "neighborhood": "cached panorama",
    "lat": 1.2980881345228992,
    "lng": 103.85554045821432,
    "year": 1920,
    "panorama": "/panoramas/demo/singapore-past.jpg",
    "present": "/panoramas/demo/singapore-present.jpg",
    "startYaw": 351.0309150783512,
    "note": null,
    "tidbits": [
      {
        "id": "wiki-Public Service Commission (Singapore)",
        "kind": "history",
        "title": "Public Service Commission (Singapore)",
        "body": "The Public Service Commission (PSC) has a constitutional role to appoint, confirm, promote, transfer, dismiss and exercise disciplinary control over public officers in Singapore. It is constituted under Part IX of the Constitution of Singapore.\nThe PSC also retains two key non-constitutional roles. It considers the suitability...",
        "pitch": 0,
        "yaw": -113.1816267032595,
        "source": "https://en.wikipedia.org/wiki/Public_Service_Commission_(Singapore)"
      },
      {
        "id": "wiki-National Library, Singapore",
        "kind": "history",
        "title": "National Library, Singapore",
        "body": "The National Library is the flagship national library of Singapore. A subsidiary of the National Library Board (NLB), it consists of twin 16-storey blocks, linked by bridges on the upper floors, with three underground basements  located on an 11,304-square-metre (121,680 sq ft) prime location in Victoria Street within the...",
        "pitch": 8,
        "yaw": -103.2512318451636,
        "source": "https://en.wikipedia.org/wiki/National_Library%2C_Singapore"
      },
      {
        "id": "wiki-Victoria Street, Singapore",
        "kind": "history",
        "title": "Victoria Street, Singapore",
        "body": "Victoria Street is a major two-way road in Singapore. It links Kallang Road in the northeast with Hill Street in the southwest. En route, Victoria Street passes through the planning areas of Kallang, Rochor, Downtown Core and Museum. The road is lined with a mix of heritage landmarks, religious institutions, retail centres...",
        "pitch": 0,
        "yaw": -69.15419914295848,
        "source": "https://en.wikipedia.org/wiki/Victoria_Street%2C_Singapore"
      },
      {
        "id": "wiki-Lavender, Singapore",
        "kind": "history",
        "title": "Lavender, Singapore",
        "body": "Lavender is a subzone within the planning area of Kallang, Singapore, as defined by the Urban Redevelopment Authority (URA). Lavender is composed of an area bounded by Tessensohn Road in the north; Balestier Road, Lavender Street and Crawford Street in the east; the Rochor River and Rochor Canal in the south; as well as...",
        "pitch": 0,
        "yaw": 70.05310502953569,
        "source": "https://en.wikipedia.org/wiki/Lavender%2C_Singapore"
      },
      {
        "id": "wiki-DHL Balloon",
        "kind": "history",
        "title": "DHL Balloon",
        "body": "The DHL Balloon, in Singapore, was the world's second largest tethered helium balloon. It was inflated in 2006, and closed and dismantled in October 2008.",
        "pitch": 8,
        "yaw": 76.70785920769703,
        "source": "https://en.wikipedia.org/wiki/DHL_Balloon"
      }
    ]
  }
]

export const samples: Place[] = [cached[0], { ...timesSquareDemo, id: 'sample-times-square' }, cached[1], cached[2]]

// The courtyard scan has even coverage and a clear matching present-day view.
export const quickDemo: Place = {
  ...cached[0],
  id: 'demo-columbia-courtyard',
  name: 'Columbia University · Lerner Hall',
  neighborhood: 'courtyard demo',
}
