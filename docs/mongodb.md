# MongoDB saved-panorama demo

MongoDB stores each scan's year, history markers, original/generated image paths, timestamp and a GeoJSON point. The `scan_location` 2dsphere index supports nearby queries; coordinates are longitude first. JPEGs stay in the existing private Vercel Blob store and the image route serves them with a one-year immutable browser cache. Opening a saved panorama never calls the generation API. This is saved-content retrieval, not offline map-tile caching.

## Connect and import

Add these server-only variables to `.env.local` and to the deployment environment:

```dotenv
MONGODB_URI=mongodb+srv://YOUR_CONNECTION_STRING
MONGODB_DB=time_machine
```

Keep the existing Blob credentials. The Atlas database user needs read/write and index-creation access to this database, and Atlas network access must allow the app server. Never use a NEXT_PUBLIC variable for the URI.

Run `pnpm scans:import` once after configuring Atlas, then restart the dev server. This imports all existing Blob sidecars into `scans`, with unique scan IDs, GeoJSON locations and indexes. It does not copy or regenerate images. Repeating it is safe: imports upsert by scan ID. New generations also index metadata automatically after saving their Blob backup. If an indexing write fails, the scan remains in Blob; rerun the import to repair missing MongoDB records.

## Two demo shots

1. Open `/map` (or “explore saved panoramas” on the hero). Show the historical photo pins and the saved-photo strip.
2. Click any photo to open its saved panorama, history markers and original/past comparison. Back returns to the map. No camera permission or new generation is needed for map browsing.

For a concrete MongoDB proof, inspect GET `/api/scans?limit=200`: `source` and the `X-Scan-Store` header must both say `mongodb`. In Atlas show the `scans` collection and the `scan_location` index. A nearby request is `/api/scans?lat=40.80715&lng=-73.96394&radius=1000`.

Without MONGODB_URI, the existing Blob implementation remains available (`source: blob`). A MongoDB outage falls back to Blob (`source: blob-fallback`); this must not be presented as a successful MongoDB lookup. A configured but empty MongoDB collection stays empty until import. The map requests up to 200 recent scans; this is not an unlimited global map. Saved photo bytes can be reused from the browser cache on subsequent visits, while scan metadata refreshes on map entry. Basemap tiles still require their provider/network.
