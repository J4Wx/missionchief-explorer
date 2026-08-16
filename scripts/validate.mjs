// Validates every region data file against the JSON Schemas and the extra
// integrity rules documented in docs/03-data-schema.md and docs/04-architecture.md.
// Run: npm run validate  (also runs in CI)
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const REGIONS_DIR = 'data/regions'
const SCHEMAS_DIR = 'schemas'
// Mirrors scripts/new-region.mjs and the RegionIndexEntry type in src/types/app.ts.
const VALID_STATUSES = new Set(['requested', 'in_progress', 'published'])

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
ajv.addSchema(readJson(join(SCHEMAS_DIR, 'facility.schema.json')), 'facility.schema.json')
const validateRegion = ajv.compile(readJson(join(SCHEMAS_DIR, 'region.schema.json')))

let errorCount = 0
const fail = (file, msg) => {
  errorCount++
  console.error(`  ✗ [${file}] ${msg}`)
}

const files = readdirSync(REGIONS_DIR).filter((f) => f.endsWith('.geojson'))
if (files.length === 0) console.warn('No .geojson region files found in', REGIONS_DIR)

// index.json referential check. The registry is also the request queue, so an
// entry may legitimately have no `file` yet (status `requested`/`in_progress`);
// what must never happen is an entry pointing at a file that isn't there, a
// published region with no data, or a data file nobody registered.
const index = readJson(join(REGIONS_DIR, 'index.json'))
const entries = index.regions ?? []
const indexedFiles = new Set(entries.map((r) => r.file).filter(Boolean))

const seenRegionIds = new Set()
for (const entry of entries) {
  const where = `index.json:${entry.region_id ?? '?'}`
  if (!entry.region_id) {
    fail(where, 'entry has no region_id')
    continue
  }
  if (seenRegionIds.has(entry.region_id)) fail(where, 'duplicate region_id in the registry')
  seenRegionIds.add(entry.region_id)

  if (!VALID_STATUSES.has(entry.status)) {
    fail(where, `status "${entry.status}" must be one of: ${[...VALID_STATUSES].join(', ')}`)
  }
  if (entry.file) {
    if (!files.includes(entry.file)) fail(where, `points at missing file "${entry.file}"`)
  } else if (entry.status === 'published') {
    fail(where, 'is published but has no `file`')
  }
}

for (const file of files) {
  const errorsBefore = errorCount
  const data = readJson(join(REGIONS_DIR, file))

  // 1. JSON Schema
  if (!validateRegion(data)) {
    for (const e of validateRegion.errors ?? []) {
      fail(file, `${e.instancePath || '/'} ${e.message}`)
    }
    continue // structural errors make deeper checks unreliable
  }

  const meta = data.metadata

  // 2. Real region files must be named <region_id>.geojson.
  //    The bundled "example-*" fixtures are exempt from this naming rule.
  if (!file.startsWith('example-') && basename(file, '.geojson') !== meta.region_id) {
    fail(file, `filename should be "${meta.region_id}.geojson" to match region_id`)
  }

  // 3. region is registered in index.json
  if (!indexedFiles.has(file)) fail(file, `not registered in ${REGIONS_DIR}/index.json`)

  // 4. sub-region referential integrity
  const subs = meta.subregions ?? []
  const subIds = new Set()
  for (const s of subs) {
    if (subIds.has(s.id)) fail(file, `duplicate subregion id "${s.id}"`)
    subIds.add(s.id)
  }
  for (const s of subs) {
    if (s.parent != null) {
      if (!subIds.has(s.parent)) fail(file, `subregion "${s.id}" has unresolved parent "${s.parent}"`)
      if (s.parent === s.id) fail(file, `subregion "${s.id}" is its own parent`)
    }
  }
  // detect parent cycles
  for (const s of subs) {
    const seen = new Set([s.id])
    let cur = subs.find((x) => x.id === s.parent)
    while (cur) {
      if (seen.has(cur.id)) { fail(file, `subregion parent cycle involving "${cur.id}"`); break }
      seen.add(cur.id)
      cur = subs.find((x) => x.id === cur.parent)
    }
  }

  // 5. per-facility checks
  const ids = new Set()
  for (const feat of data.features) {
    const p = feat.properties
    if (ids.has(p.id)) fail(file, `duplicate facility id "${p.id}"`)
    ids.add(p.id)

    const [lng, lat] = feat.geometry.coordinates
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) fail(file, `facility "${p.id}" has out-of-range coordinates`)

    if (!p.sources || p.sources.length < 1) fail(file, `facility "${p.id}" has no sources`)

    if (p.subregion_id != null && !subIds.has(p.subregion_id)) {
      fail(file, `facility "${p.id}" references unknown subregion "${p.subregion_id}"`)
    }
  }

  if (errorCount === errorsBefore) {
    console.log(`  ✓ ${file} (${data.features.length} facilities, ${subs.length} sub-regions)`)
  }
}

if (errorCount > 0) {
  console.error(`\nValidation FAILED with ${errorCount} error(s).`)
  process.exit(1)
}
console.log('\nAll region data valid.')
