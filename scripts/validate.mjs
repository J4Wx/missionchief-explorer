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
// Current data schema version (docs/03-data-schema.md). 2 = internationalized:
// `state` optional, ISO-2 country codes, country-neutral trauma tiers.
const SCHEMA_VERSION = 2
// Trauma tags/attributes that encode the American College of Surgeons levels.
// They mean nothing outside the US system, so they are only valid on US
// records — every other country states its own designation instead (docs/02).
const ACS_ONLY_SPECIALTIES = /^trauma_level_\d$/

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

// Warnings print but never fail the build — for things that are legitimate but
// worth seeing, like a region file still on an older schema version.
let warningCount = 0
const warn = (file, msg) => {
  warningCount++
  console.warn(`  ! [${file}] ${msg}`)
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

  // 3b. schema version. Newer-than-known means this checkout can't judge the
  //     file; older is fine but flagged, since migrations are the phase's job.
  if (meta.schema_version > SCHEMA_VERSION) {
    fail(file, `schema_version ${meta.schema_version} is newer than this validator knows (${SCHEMA_VERSION})`)
  } else if (meta.schema_version < SCHEMA_VERSION) {
    warn(file, `schema_version ${meta.schema_version} — current is ${SCHEMA_VERSION} (see docs/03-data-schema.md)`)
  }

  // 3c. the region_id prefix must agree with the declared country, so a GB
  //     region can't sit behind a `us-` slug (docs/03 conventions).
  const prefix = meta.region_id.split('-')[0]
  if (prefix !== meta.country.toLowerCase()) {
    fail(file, `region_id "${meta.region_id}" starts with "${prefix}-" but country is "${meta.country}"`)
  }

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

    // A facility in another country than its region is legal (border metros)
    // but almost always a mistake worth seeing.
    if (p.address.country !== meta.country) {
      warn(file, `facility "${p.id}" is in ${p.address.country} but the region is ${meta.country}`)
    }

    // ACS trauma levels are a US construct. Elsewhere the record states its own
    // system in attributes.trauma_designation and tiers with trauma_major /
    // trauma_unit — asserting "Level I" for a UK hospital would be fabrication.
    if (p.address.country !== 'US') {
      const acs = (p.specialties ?? []).filter((s) => ACS_ONLY_SPECIALTIES.test(s))
      if (acs.length) {
        fail(file, `facility "${p.id}" (${p.address.country}) carries ACS-only ${acs.join('/')} — use trauma_major/trauma_unit + attributes.trauma_designation`)
      }
      if (p.attributes?.trauma_level != null) {
        fail(file, `facility "${p.id}" (${p.address.country}) sets attributes.trauma_level, which is the ACS numeric scale — use attributes.trauma_designation`)
      }
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
console.log(`\nAll region data valid.${warningCount > 0 ? ` (${warningCount} warning(s))` : ''}`)
