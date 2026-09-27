import { loadEnvConfig } from '@next/env'
import { listScanIndex, readScan, scanStoreEnabled } from '../src/lib/scanStore'
import { indexScan, mongoEnabled } from '../src/lib/mongoScans'

loadEnvConfig(process.cwd())

async function main() {
  if (!mongoEnabled() || !scanStoreEnabled()) throw new Error('Configure MONGODB_URI and Blob storage in .env.local first.')
  const entries = await listScanIndex()
  let imported = 0
  for (const entry of entries) {
    const scan = await readScan(entry.pathname)
    if (!scan) throw new Error('A saved scan could not be read. Retry the import.')
    await indexScan(scan)
    imported++
  }
  console.log(`Imported ${imported} saved scans into MongoDB. Images remain in Blob. Safe to rerun.`)
}

main().then(() => process.exit(0)).catch(() => {
  console.error('Import failed. Check MONGODB_URI, Atlas network access, database write permissions and Blob configuration. Already imported scans are safe; rerun to finish.')
  process.exit(1)
})
