// Validates every region data file against the JSON Schemas and the extra
// integrity rules documented in docs/03-data-schema.md and docs/04-architecture.md.
// Run: npm run validate  (also runs in CI)
import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { isInSync, loadComposite, mergeRegion } from './lib/merge.mjs'
import {
  MANIFEST_FILE,
  REGIONS_DIR as DEFAULT_REGIONS_DIR,
  SCHEMA_VERSION,
  compositeRegionIds,
  readJson,
  subtreeIds,
} from './lib/regions.mjs'

// The real data directory by default. An alternative can be passed in so the
// rules below can be exercised against deliberately broken fixtures — see
// scripts/validate.test.mjs.
const REGIONS_DIR = process.argv[2] ?? DEFAULT_REGIONS_DIR
const SCHEMAS_DIR = 'schemas'
// Mirrors scripts/new-region.mjs and the RegionIndexEntry type in src/types/app.ts.
// Part manifests reuse it: a part is queued, claimed and published the same way.
const VALID_STATUSES = new Set(['requested', 'in_progress', 'published'])
// Trauma tags/attributes that encode the American College of Surgeons levels.
// They mean nothing outside the US system, so they are only valid on US
// records — every other country states its own designation instead (docs/02).
const ACS_ONLY_SPECIALTIES = /^trauma_level_\d$/

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
// Registered by filename, which is how the schemas $ref each other: the part
// and manifest schemas reuse the region schema's metadata, sub-region and
// feature definitions rather than restating them.
for (const name of ['facility', 'region', 'region-manifest', 'region-part']) {
  ajv.addSchema(readJson(join(SCHEMAS_DIR, `${name}.schema.json`)), `${name}.schema.json`)
}
const validateRegion = ajv.getSchema('region.schema.json')
const validateManifest = ajv.getSchema('region-manifest.schema.json')
const validatePart = ajv.getSchema('region-part.schema.json')

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

/** Metadata + facility count of each region file, for the registry checks below. */
const regionFiles = new Map(
  files.map((f) => {
    try {
      const data = readJson(join(REGIONS_DIR, f))
      return [f, { meta: data.metadata ?? {}, count: (data.features ?? []).length }]
    } catch {
      // A malformed file fails its own checks below; nothing to compare against.
      return [f, null]
    }
  }),
)

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

  // `center` and `facility_count` are the global map's pins (docs/05). They
  // duplicate the region file so the default view can plot every region without
  // downloading any of them, which is only safe if they can't drift — so both
  // are checked against the file whenever one exists.
  const source = entry.file ? regionFiles.get(entry.file) : null

  if (entry.center !== undefined) {
    const center = entry.center
    if (!Array.isArray(center) || center.length !== 2 || center.some((n) => typeof n !== 'number')) {
      fail(where, 'center must be [lng, lat]')
    } else if (center[0] < -180 || center[0] > 180 || center[1] < -90 || center[1] > 90) {
      fail(where, `center [${center}] is out of range`)
    } else if (
      // A file with no usable center of its own fails its own schema check;
      // repeating that here would only be noise.
      Array.isArray(source?.meta.center) &&
      (source.meta.center[0] !== center[0] || source.meta.center[1] !== center[1])
    ) {
      fail(where, `center [${center}] disagrees with ${entry.file} ([${source.meta.center}])`)
    }
  } else if (entry.status === 'published') {
    fail(where, 'is published but has no `center` — the global map has nowhere to pin it')
  }

  if (entry.facility_count !== undefined) {
    if (!Number.isInteger(entry.facility_count) || entry.facility_count < 0) {
      fail(where, 'facility_count must be a non-negative integer')
    } else if (source && entry.facility_count !== source.count) {
      fail(where, `facility_count ${entry.facility_count} disagrees with ${entry.file} (${source.count})`)
    }
  } else if (entry.status === 'published') {
    warn(where, 'has no facility_count — the global map will pin it without a count')
  }

  // The region picker groups by country → division, so `admin` has to agree
  // with the division segment of the region_id it claims to describe.
  const adminFromId = entry.region_id.split('-').length > 2
    ? entry.region_id.split('-')[1]
    : undefined
  if (entry.admin !== undefined) {
    if (entry.admin !== adminFromId) {
      fail(where, `admin "${entry.admin}" disagrees with region_id (expected "${adminFromId ?? 'none'}")`)
    }
    if (entry.admin_name === undefined) {
      warn(where, `has admin "${entry.admin}" but no admin_name — the picker will label the group "${entry.admin.toUpperCase()}"`)
    }
  } else if (entry.admin_name !== undefined) {
    fail(where, 'has admin_name but no admin')
  } else if (adminFromId !== undefined) {
    warn(where, `has no admin/admin_name — the picker can't group it under "${adminFromId}"`)
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

// ── regions generated in parts ────────────────────────────────────────────────
// A composite region's metadata lives in data/regions/parts/<id>/region.json and
// its facilities in one file per part, so the region file above is a build
// artifact. These checks are what let a borough be generated on its own without
// two parts quietly claiming the same facility — or the merged file drifting
// from what the parts now say (docs/06 § Regions generated in parts).
for (const regionId of compositeRegionIds(REGIONS_DIR)) {
  const where = `parts/${regionId}`
  let composite
  try {
    composite = loadComposite(regionId, REGIONS_DIR)
  } catch (err) {
    fail(where, `can't read ${MANIFEST_FILE}: ${err.message}`)
    continue
  }
  const { manifest, parts, unreadable, stray } = composite

  if (!validateManifest(manifest)) {
    for (const e of validateManifest.errors ?? []) fail(`${where}/${MANIFEST_FILE}`, `${e.instancePath || '/'} ${e.message}`)
    continue
  }
  for (const { id, message } of unreadable) fail(`${where}/${id}.geojson`, `is not readable JSON: ${message}`)
  for (const file of stray) {
    fail(`${where}/${file}`, `is not listed in ${MANIFEST_FILE} — every part file must be declared`)
  }

  const meta = manifest.metadata
  if (meta.region_id !== regionId) {
    fail(`${where}/${MANIFEST_FILE}`, `region_id "${meta.region_id}" disagrees with the directory name`)
  }

  const manifestSubs = meta.subregions ?? []
  const declared = new Set(manifestSubs.map((s) => s.id))
  const partIds = new Set()
  // Facility ids only have to be unique within the merged region, which is a
  // rule two agents working in parallel can break without either file being
  // wrong on its own — so say which two parts collided.
  const facilityOwner = new Map()

  for (const part of manifest.parts ?? []) {
    const partWhere = `${where}/${part.id}.geojson`
    if (partIds.has(part.id)) fail(`${where}/${MANIFEST_FILE}`, `duplicate part id "${part.id}"`)
    partIds.add(part.id)

    if (part.subregion_id != null && !declared.has(part.subregion_id)) {
      fail(`${where}/${MANIFEST_FILE}`, `part "${part.id}" covers undeclared sub-region "${part.subregion_id}"`)
    }

    const data = parts.get(part.id)
    if (!data) {
      // The manifest is the part-level request queue, so a part with no file is
      // the normal mid-generation state — unless it claims to be finished.
      if (part.status === 'published') fail(`${where}/${MANIFEST_FILE}`, `part "${part.id}" is published but ${part.id}.geojson does not exist`)
      continue
    }

    if (!validatePart(data)) {
      for (const e of validatePart.errors ?? []) fail(partWhere, `${e.instancePath || '/'} ${e.message}`)
      continue
    }
    if (data.part.region_id !== regionId) {
      fail(partWhere, `part.region_id "${data.part.region_id}" disagrees with the region it sits under`)
    }
    if (data.part.part_id !== part.id) {
      fail(partWhere, `part.part_id "${data.part.part_id}" disagrees with the filename`)
    }
    if (data.part.schema_version > SCHEMA_VERSION) {
      fail(partWhere, `schema_version ${data.part.schema_version} is newer than this validator knows (${SCHEMA_VERSION})`)
    }

    // A part may only add divisions *inside* the region's declared ones. That
    // is the rule that keeps parallel parts from colliding: a top-level
    // division belongs to the manifest, which one PR owns at a time.
    const own = data.part.subregions ?? []
    const ownIds = new Set(own.map((s) => s.id))
    for (const sub of own) {
      if (declared.has(sub.id)) fail(partWhere, `sub-region "${sub.id}" is already declared in ${MANIFEST_FILE}`)
      if (sub.parent == null) {
        fail(partWhere, `sub-region "${sub.id}" has no parent — a part may only nest divisions inside the region's own`)
      } else if (!declared.has(sub.parent) && !ownIds.has(sub.parent)) {
        fail(partWhere, `sub-region "${sub.id}" has unresolved parent "${sub.parent}"`)
      }
    }

    // Every facility in a borough file belongs to that borough. Without this a
    // part can silently annex another one's facilities and the merged file
    // still validates.
    const lane = part.subregion_id ? subtreeIds([...manifestSubs, ...own], part.subregion_id) : null
    for (const feat of data.features) {
      const id = feat.properties.id
      const owner = facilityOwner.get(id)
      if (owner) fail(partWhere, `facility "${id}" is also in part "${owner}"`)
      else facilityOwner.set(id, part.id)

      if (!lane) continue
      const sub = feat.properties.subregion_id
      if (sub == null) {
        warn(partWhere, `facility "${id}" has no subregion_id — part "${part.id}" covers "${part.subregion_id}"`)
      } else if (!lane.has(sub)) {
        fail(partWhere, `facility "${id}" is in sub-region "${sub}", outside part "${part.id}" ("${part.subregion_id}")`)
      }
    }
  }

  // The merged file is generated, and the only thing keeping it honest is that
  // re-merging reproduces it. Anything else — a hand edit, a forgotten merge —
  // shows up here rather than in the app.
  const { region: merged, included, pending } = mergeRegion(manifest, parts)
  const target = `${regionId}.geojson`
  if (!files.includes(target)) {
    fail(where, `has no merged region file — run \`npm run merge-region -- --id ${regionId}\``)
  } else {
    const committed = readJson(join(REGIONS_DIR, target))
    if (!isInSync(committed, merged)) {
      fail(
        target,
        `is out of date with its ${included.length} part(s) — run \`npm run merge-region -- --id ${regionId}\`` +
          ` (merging gives ${merged.features.length} facilities, the file has ${(committed.features ?? []).length})`,
      )
    } else {
      console.log(
        `  ✓ ${where} (${included.length}/${manifest.parts?.length ?? 0} parts merged` +
          `${pending.length > 0 ? `, ${pending.length} pending` : ''})`,
      )
    }
  }
}

if (errorCount > 0) {
  console.error(`\nValidation FAILED with ${errorCount} error(s).`)
  process.exit(1)
}
console.log(`\nAll region data valid.${warningCount > 0 ? ` (${warningCount} warning(s))` : ''}`)
