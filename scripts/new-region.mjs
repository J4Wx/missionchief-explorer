// Scaffolds a region: registers it in data/regions/index.json and, with
// --scaffold, writes an empty but schema-valid region file to fill in.
//
// The registry is also the *request queue* — entries can sit at `requested`
// with no data file at all, which is how a batch of regions gets asked for in
// one go and picked up by the generation agent one at a time (docs/06).
//
// A region too big for one agent run (--split) gets the same treatment one
// level down: a manifest under data/regions/parts/<id>/ that owns the region's
// metadata and queues its parts, so each borough is generated, reviewed and
// merged on its own. `npm run merge-region` assembles them.
//
// Run: npm run new-region -- --help
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadComposite, mergeRegion } from './lib/merge.mjs'
import { die, parseArgs } from './lib/cli.mjs'
import {
  PARTS_DIR,
  REGIONS_DIR,
  SCHEMA_VERSION,
  applyDerived,
  indexPath,
  manifestPath,
  partPath,
  partsDir,
  readJson,
  regionPath,
  writeJson,
} from './lib/regions.mjs'

const INDEX_PATH = indexPath()
const STATUSES = ['requested', 'in_progress', 'published']
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COUNTRY_PATTERN = /^[A-Z]{2}$/
// The sub-region kinds are the schema's list, read rather than repeated.
const SUBREGION_LEVELS =
  readJson('schemas/region.schema.json').properties.metadata.properties.subregions.items
    .properties.level.enum

const USAGE = `
Scaffold a Dispatch Atlas region.

Usage:
  npm run new-region -- --id <region_id> --name "<Display name>" [options]
  npm run new-region -- --id <region_id> --part <part_id> [options]
  npm run new-region -- --list
  npm run new-region -- --batch <file.json>

Required (unless --list / --batch / --part):
  --id <slug>          region_id, e.g. us-ny-buffalo  (lowercase kebab-case)
  --name "<text>"      display name, e.g. "Buffalo, NY (Erie County)"

Options:
  --country <code>     ISO 3166-1 alpha-2, e.g. US, GB, DE  (default: from --id)
  --admin <code>       first-level division code, as in --id (default: from --id)
  --admin-name "<text>" display name for it, e.g. "Georgia", "Merseyside" —
                       the region picker groups countries by this
  --edition <code>     Mission Chief edition the game notes
                       target, ISO-2                        (default: --country)
  --status <status>    requested | in_progress | published  (default: requested)
  --center <lng,lat>   map center, and the region's pin on the global map;
                       copied from the data file once one exists
  --zoom <n>           default map zoom                     (scaffold only, default: 11)
  --note "<text>"      why this region, or what to focus on
  --scaffold           also write an empty region .geojson to fill in
  --force              overwrite an existing entry / file
  --list               print the current queue and exit
  --sync               re-copy the fields the registry mirrors out of the region
                       files (pin, facility count, review date) — what to run
                       after a depth pass edits a region in place; with --id,
                       just that one
  --batch <file.json>  queue many regions at once; the file is a JSON array of
                       objects with the same keys as the flags above
  --help               show this

Regions generated in parts (docs/06 — for metros too big for one agent run):
  --split              generate this region one part at a time: writes the
                       manifest data/regions/parts/<id>/region.json and the
                       merged region file it produces (implies --scaffold)
  --parts "<list>"     the parts to queue, comma-separated "id:Display Name"
                       (implies --split), e.g. "manhattan:Manhattan,bronx:The Bronx"
  --part-level <level> what kind of division the parts are (default: borough)
                       one of: ${SUBREGION_LEVELS.join(', ')}
  --part <part_id>     add or claim ONE part of a split region, with --id
  --subregion <id>     the sub-region that part covers (default: the part id;
                       "none" for a deliberately region-wide part)

Examples:
  # queue a request for the agent to pick up later (country US, from the id)
  npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY (Erie County)" \\
    --admin-name "New York"

  # a UK region — note GB, not UK, and the UK edition for the game notes
  npm run new-region -- --id gb-mersey-liverpool --name "Liverpool (Merseyside)" \\
    --admin-name Merseyside

  # start work on one now, with an empty file ready to fill in
  npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY" \\
    --center -78.8784,42.8864 --zoom 11 --scaffold --status in_progress

  # a metro generated a borough at a time
  npm run new-region -- --id us-ny-nyc --name "New York City, NY" \\
    --admin-name "New York" --center -73.97,40.7 --zoom 10 --part-level borough \\
    --parts "manhattan:Manhattan,brooklyn:Brooklyn,queens:Queens,bronx:The Bronx,staten-island:Staten Island"

  # claim one borough and scaffold its file
  npm run new-region -- --id us-ny-nyc --part manhattan --status in_progress --scaffold

  # queue a whole batch
  npm run new-region -- --batch regions-wanted.json
`

/** Parse "--center lng,lat" into [lng, lat], validating the range. */
function parseCenter(value) {
  const parts = String(value).split(',').map((n) => Number(n.trim()))
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    die(`--center must be "lng,lat" (got "${value}")`)
  }
  const [lng, lat] = parts
  if (lng < -180 || lng > 180) die(`--center longitude ${lng} is out of range`)
  if (lat < -90 || lat > 90) die(`--center latitude ${lat} is out of range`)
  return [lng, lat]
}

/** A region file to copy the registry's pin fields out of, or null if unreadable. */
function readRegion(path) {
  try {
    return readJson(path)
  } catch (err) {
    die(`couldn't read ${path} to copy its center: ${err.message}`)
  }
}

const today = () => new Date().toISOString().slice(0, 10)

/** The metadata block shared by a plain region file and a parts manifest. */
function baseMetadata(spec) {
  return {
    region_id: spec.id,
    name: spec.name,
    country: spec.country,
    game_edition: spec.edition,
    // [0, 0] is Null Island — a placeholder to replace with the real center,
    // and one that stands out on the map if it ever isn't.
    center: spec.center ?? [0, 0],
    zoom: spec.zoom,
    subregions: spec.subregions ?? [],
    generated_by: 'agent',
    generated_at: today(),
    // A first pass is a review: the clock docs/07 Phase 8 ranks starts here.
    last_reviewed: today(),
    schema_version: SCHEMA_VERSION,
  }
}

/** An empty region file that already passes `npm run validate`. */
function emptyRegion(spec) {
  return { type: 'FeatureCollection', metadata: baseMetadata(spec), features: [] }
}

/** An empty part file for one borough, ready for the agent that claims it. */
function emptyPart(regionId, part) {
  return {
    type: 'FeatureCollection',
    part: {
      region_id: regionId,
      part_id: part.id,
      ...(part.name ? { name: part.name } : {}),
      subregions: [],
      generated_by: 'agent',
      generated_at: today(),
      schema_version: SCHEMA_VERSION,
    },
    features: [],
  }
}

/** Turn "manhattan:Manhattan,bronx:The Bronx" (or a batch array) into parts. */
function parseParts(raw, level) {
  if (raw === undefined || raw === true) return []
  const entries = Array.isArray(raw)
    ? raw
    : String(raw)
        .split(',')
        .map((chunk) => {
          const [id, ...rest] = chunk.split(':')
          return { id: id.trim(), name: rest.join(':').trim() || undefined }
        })

  return entries.map((entry) => {
    const id = String(entry.id ?? '').trim()
    if (!ID_PATTERN.test(id)) {
      die(`part id "${id}" must be lowercase kebab-case, e.g. staten-island`)
    }
    return {
      id,
      // Without a display name the part is still usable, but the sub-region it
      // creates would be labeled with its slug — so fall back to a readable one.
      name: entry.name ?? titleize(id),
      level,
      status: entry.status ?? 'requested',
      note: entry.note,
    }
  })
}

const titleize = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')

/** Normalize + validate one region spec from flags or a batch file entry. */
function toSpec(raw) {
  const id = raw.id
  const name = raw.name
  if (typeof id !== 'string' || !id) die('--id is required (see --help)')
  if (typeof name !== 'string' || !name) die(`--name is required for "${id}"`)
  if (!ID_PATTERN.test(id)) {
    die(`region_id "${id}" must be lowercase kebab-case, e.g. us-ny-buffalo`)
  }

  const status = raw.status ?? 'requested'
  if (!STATUSES.includes(status)) {
    die(`status "${status}" for "${id}" must be one of: ${STATUSES.join(', ')}`)
  }

  const level = raw['part-level'] ?? raw.part_level ?? 'borough'
  if (!SUBREGION_LEVELS.includes(level)) {
    die(`--part-level "${level}" must be one of: ${SUBREGION_LEVELS.join(', ')}`)
  }
  const parts = parseParts(raw.parts, level)
  const split = raw.split === true || raw.split === 'true' || parts.length > 0

  // A split region's metadata lives in its manifest, and the merged file it
  // produces is written from there — so it is always scaffolded, never empty.
  const scaffold = split || raw.scaffold === true || raw.scaffold === 'true'
  // A published entry with no data file would break the app's region picker.
  if (status === 'published' && !scaffold && !existsSync(regionPath(id))) {
    die(`"${id}" is marked published but ${id}.geojson does not exist — add --scaffold`)
  }

  const country = countryOf(raw, id)
  const edition = raw.edition === undefined ? country : String(raw.edition).toUpperCase()
  if (!COUNTRY_PATTERN.test(edition)) {
    die(`--edition "${raw.edition}" must be an ISO 3166-1 alpha-2 code, e.g. US, GB`)
  }

  const { admin, admin_name } = adminOf(raw, id)

  return {
    id,
    name,
    country,
    admin,
    admin_name,
    edition,
    status,
    note: typeof raw.note === 'string' ? raw.note : undefined,
    scaffold,
    split,
    parts,
    // One sub-region per part, so a facility can say which borough it is in
    // from day one and the manifest's `subregion_id` references resolve.
    subregions: parts.map((p) => ({ id: p.id, name: p.name, level: p.level, parent: null })),
    center: raw.center ? parseCenter(raw.center) : undefined,
    zoom: raw.zoom === undefined ? 11 : Number(raw.zoom),
  }
}

/**
 * The country a region is in, as ISO 3166-1 alpha-2. `region_id` already leads
 * with it by convention (`us-ga-savannah`, `gb-mersey-liverpool`), so it is
 * derived rather than defaulted — a `gb-` region silently registered as US was
 * the failure mode worth designing out (docs/03 conventions).
 */
function countryOf(raw, id) {
  if (raw.country !== undefined) {
    const code = String(raw.country).toUpperCase()
    if (!COUNTRY_PATTERN.test(code)) {
      die(`--country "${raw.country}" must be an ISO 3166-1 alpha-2 code, e.g. US, GB, DE`)
    }
    return code
  }
  const prefix = id.split('-')[0].toUpperCase()
  if (!COUNTRY_PATTERN.test(prefix)) {
    die(`can't infer the country from region_id "${id}" — pass --country (ISO-2, e.g. GB)`)
  }
  return prefix
}

/**
 * The first-level division (state/county/Land) a region sits in, as the code
 * `region_id` already carries in its middle segment. The registry stores it so
 * the picker can group `us-ga-savannah` under Georgia without parsing slugs.
 * Returns `{}` for an id that has no middle segment.
 */
function adminOf(raw, id) {
  const fromId = id.split('-').length > 2 ? id.split('-')[1] : undefined
  const code = raw.admin === undefined ? fromId : String(raw.admin).toLowerCase()
  const name = raw['admin-name'] ?? raw.admin_name

  if (code !== undefined && !ID_PATTERN.test(code)) {
    die(`--admin "${raw.admin}" must be lowercase kebab-case, e.g. ga, mersey`)
  }
  if (code === undefined && name !== undefined) {
    die(`--admin-name given for "${id}" but there is no division code — pass --admin`)
  }
  if (code !== undefined && fromId !== undefined && code !== fromId) {
    die(`--admin "${code}" disagrees with region_id "${id}" (expected "${fromId}")`)
  }
  return { admin: code, admin_name: typeof name === 'string' ? name : undefined }
}

function listQueue(index) {
  const regions = index.regions ?? []
  if (regions.length === 0) {
    console.log('The region registry is empty.')
    return
  }
  const width = Math.max(...regions.map((r) => r.region_id.length))
  for (const status of STATUSES) {
    const group = regions.filter((r) => r.status === status)
    if (group.length === 0) continue
    console.log(`\n${status} (${group.length})`)
    for (const r of group) {
      const file = r.file ? `→ ${r.file}` : '(no file yet)'
      console.log(`  ${r.region_id.padEnd(width)}  ${r.name}  ${file}`)
      // A split region has a queue of its own; a flat list of regions would
      // show it as one line of work when it is a dozen.
      if (existsSync(manifestPath(r.region_id))) {
        for (const part of readJson(manifestPath(r.region_id)).parts ?? []) {
          const has = existsSync(partPath(r.region_id, part.id)) ? '' : ' (no file yet)'
          console.log(`  ${' '.repeat(width)}    · ${part.id} — ${part.status}${has}`)
        }
      }
    }
  }
  console.log()
}

/** Write the merged region file for a split region, and pin the registry to it. */
function syncMerged(regionId, index) {
  const { manifest, parts } = loadComposite(regionId)
  const { region, included } = mergeRegion(manifest, parts)
  writeJson(regionPath(regionId), region)
  const entry = index.regions?.find((r) => r.region_id === regionId)
  if (entry) {
    entry.file = `${regionId}.geojson`
    applyDerived(entry, region)
  }
  return { region, included, total: manifest.parts?.length ?? 0 }
}

/** Add or replace one registry entry + optional data file. Returns a summary. */
function addRegion(index, spec, force) {
  const existing = index.regions.findIndex((r) => r.region_id === spec.id)
  if (existing !== -1 && !force) {
    die(`"${spec.id}" is already in ${INDEX_PATH} (use --force to replace it)`)
  }

  const filePath = regionPath(spec.id)
  const hasFile = existsSync(filePath)
  let wroteFile = false

  if (spec.split) {
    const manifest = manifestPath(spec.id)
    if (existsSync(manifest) && !force) {
      die(`${manifest} already exists (use --force to replace it)`)
    }
    mkdirSync(partsDir(spec.id), { recursive: true })
    writeJson(manifest, {
      metadata: baseMetadata(spec),
      parts: spec.parts.map((p) => ({
        id: p.id,
        name: p.name,
        subregion_id: p.id,
        status: p.status,
        ...(p.note ? { note: p.note } : {}),
      })),
    })
    // The merged file is written from the manifest, never by hand — including
    // the empty one, so it matches what `merge-region` will produce later.
    writeJson(filePath, mergeRegion({ metadata: baseMetadata(spec), parts: [] }, new Map()).region)
    wroteFile = true
  } else if (spec.scaffold) {
    if (hasFile && !force) {
      die(`${filePath} already exists (use --force to overwrite it)`)
    }
    writeJson(filePath, emptyRegion(spec))
    wroteFile = true
  }

  // `admin`/`admin_name` are the region picker's grouping (docs/05); without a
  // display name the picker falls back to the bare code, so pass --admin-name.
  const entry = {
    region_id: spec.id,
    name: spec.name,
    country: spec.country,
    ...(spec.admin ? { admin: spec.admin } : {}),
    ...(spec.admin_name ? { admin_name: spec.admin_name } : {}),
    status: spec.status,
  }
  // A queued request has no file yet; the key is omitted rather than left empty
  // so the registry never points at something that isn't there.
  if (wroteFile || hasFile) entry.file = `${spec.id}.geojson`

  // The region's pin on the global map (docs/05). Copied from the data file
  // whenever there is one — `npm run validate` compares the two — so filling in
  // a scaffolded region and re-running this is enough to keep them in step. A
  // still-queued region records only the --center it was asked for, if any.
  const data = wroteFile || hasFile ? readRegion(filePath) : null
  if (data) applyDerived(entry, data)
  else if (spec.center) entry.center = spec.center

  if (spec.note) entry.note = spec.note

  if (existing === -1) index.regions.push(entry)
  else index.regions[existing] = entry

  return { entry, wroteFile, replaced: existing !== -1 }
}

/**
 * Add or claim one part of a split region. This is the borough-level twin of
 * queueing a region: it edits the manifest, optionally writes an empty part
 * file, and re-merges so the region file never lags its manifest.
 */
function addPart(index, args) {
  const regionId = args.id
  const partId = args.part
  if (typeof regionId !== 'string' || !regionId) die('--part needs --id <region_id> too')
  if (typeof partId !== 'string' || !ID_PATTERN.test(partId)) {
    die(`--part "${partId}" must be lowercase kebab-case, e.g. staten-island`)
  }
  if (!existsSync(manifestPath(regionId))) {
    die(
      `"${regionId}" is not generated in parts — no ${manifestPath(regionId)}.\n` +
        `  start one with: npm run new-region -- --id ${regionId} --name "…" --parts "…"`,
    )
  }

  const manifest = readJson(manifestPath(regionId))
  manifest.parts ??= []
  const status = args.status ?? 'in_progress'
  if (!STATUSES.includes(status)) {
    die(`status "${status}" must be one of: ${STATUSES.join(', ')}`)
  }

  const subregions = (manifest.metadata.subregions ??= [])
  const requested = args.subregion === undefined ? partId : String(args.subregion)
  const subregionId = requested === 'none' ? undefined : requested
  const name = typeof args.name === 'string' ? args.name : titleize(partId)

  if (subregionId && !subregions.some((s) => s.id === subregionId)) {
    if (args.subregion !== undefined) {
      die(`--subregion "${subregionId}" is not declared in ${manifestPath(regionId)}`)
    }
    // A part named after a division nobody declared yet is a new division —
    // the common case when a region gains a borough after it was queued.
    const level = args['part-level'] ?? subregions[0]?.level ?? 'borough'
    if (!SUBREGION_LEVELS.includes(level)) {
      die(`--part-level "${level}" must be one of: ${SUBREGION_LEVELS.join(', ')}`)
    }
    subregions.push({ id: subregionId, name, level, parent: null })
  }

  const existing = manifest.parts.findIndex((p) => p.id === partId)
  const entry = {
    id: partId,
    name,
    ...(subregionId ? { subregion_id: subregionId } : {}),
    status,
    ...(typeof args.note === 'string' ? { note: args.note } : {}),
  }
  if (existing === -1) manifest.parts.push(entry)
  else manifest.parts[existing] = { ...manifest.parts[existing], ...entry }

  writeJson(manifestPath(regionId), manifest)

  const file = partPath(regionId, partId)
  let wroteFile = false
  if (args.scaffold === true && (!existsSync(file) || args.force === true)) {
    writeJson(file, emptyPart(regionId, entry))
    wroteFile = true
  } else if (args.scaffold === true) {
    die(`${file} already exists (use --force to overwrite it)`)
  }

  const { total } = syncMerged(regionId, index)
  console.log(
    `  ✓ ${existing === -1 ? 'queued' : 'updated'} part ${regionId}/${partId} (${status})` +
      `${wroteFile ? ` + ${file}` : ''}`,
  )
  console.log(`    · ${total} part(s) in ${manifestPath(regionId)}`)
  return true
}

/**
 * Re-copy the fields a registry entry mirrors out of its region file. A depth
 * pass (docs/06 § Depth passes) edits a published region in place — bumping
 * `metadata.last_reviewed`, and often the facility count with it — and this is
 * how that reaches the registry, since `index.json` is this script's to write
 * and nobody else's. `npm run validate` fails on the drift this fixes.
 */
function syncRegistry(index, only) {
  let synced = 0
  let seen = 0
  for (const entry of index.regions) {
    if (only && entry.region_id !== only) continue
    seen++
    if (!entry.file) continue
    const path = join(REGIONS_DIR, entry.file)
    if (!existsSync(path)) {
      console.warn(`  ! ${entry.region_id} points at ${entry.file}, which doesn't exist`)
      continue
    }
    const before = JSON.stringify(entry)
    applyDerived(entry, readJson(path))
    if (JSON.stringify(entry) === before) continue
    synced++
    console.log(
      `  ✓ ${entry.region_id} — ${entry.facility_count} facilities` +
        `${entry.last_reviewed ? `, reviewed ${entry.last_reviewed}` : ''}`,
    )
  }
  if (only && seen === 0) die(`"${only}" is not in ${INDEX_PATH}`)
  console.log(synced === 0 ? '  · registry already matches the region files' : '')
  return synced
}

// ── main ──────────────────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2))

if (args.help || process.argv.length <= 2) {
  console.log(USAGE.trim())
  process.exit(0)
}

const index = readJson(INDEX_PATH)
index.regions ??= []

if (args.list) {
  listQueue(index)
  process.exit(0)
}

if (args.sync === true) {
  const only = typeof args.id === 'string' ? args.id : null
  const synced = syncRegistry(index, only)
  if (synced > 0) {
    writeJson(INDEX_PATH, index)
    console.log(`Registry written: ${INDEX_PATH}`)
  }
  process.exit(0)
}

if (args.part !== undefined) {
  addPart(index, args)
  writeJson(INDEX_PATH, index)
  console.log(`\nRegistry written: ${INDEX_PATH}`)
  console.log('\nNext: generate the part per docs/06-data-generation-agent.md, then run')
  console.log(`\`npm run merge-region -- --id ${args.id}\` and \`npm run validate\`.`)
  process.exit(0)
}

const specs = args.batch
  ? (() => {
      const batch = readJson(args.batch)
      if (!Array.isArray(batch)) die(`${args.batch} must contain a JSON array of regions`)
      return batch.map(toSpec)
    })()
  : [toSpec(args)]

const seen = new Set()
for (const spec of specs) {
  if (seen.has(spec.id)) die(`duplicate region_id "${spec.id}" in the batch`)
  seen.add(spec.id)
}

for (const spec of specs) {
  const { entry, wroteFile, replaced } = addRegion(index, spec, args.force === true)
  const what = replaced ? 'updated' : 'queued'
  console.log(`  ✓ ${what} ${entry.region_id} (${entry.status})${wroteFile ? ` + ${entry.file}` : ''}`)
  if (spec.split) {
    console.log(
      `    · ${spec.parts.length} part(s) queued in ${REGIONS_DIR}/${PARTS_DIR}/${spec.id}/region.json`,
    )
  }
}

writeJson(INDEX_PATH, index)
console.log(`\nRegistry written: ${INDEX_PATH}`)

const needsData = specs.filter((s) => s.status !== 'published')
if (needsData.length > 0) {
  console.log(
    `\nNext: generate the data per docs/06-data-generation-agent.md, then run \`npm run validate\`.`,
  )
}
const split = specs.filter((s) => s.split)
if (split.length > 0) {
  console.log(
    `Parts are claimed one at a time with \`npm run new-region -- --id ${split[0].id} --part <part_id> --scaffold\`,\n` +
      'and assembled with `npm run merge-region -- --id ' + split[0].id + '`.',
  )
}
