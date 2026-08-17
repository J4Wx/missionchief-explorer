// Scaffolds a region: registers it in data/regions/index.json and, with
// --scaffold, writes an empty but schema-valid region file to fill in.
//
// The registry is also the *request queue* — entries can sit at `requested`
// with no data file at all, which is how a batch of regions gets asked for in
// one go and picked up by the generation agent one at a time (docs/06).
//
// Run: npm run new-region -- --help
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REGIONS_DIR = 'data/regions'
const INDEX_PATH = join(REGIONS_DIR, 'index.json')
const STATUSES = ['requested', 'in_progress', 'published']
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const COUNTRY_PATTERN = /^[A-Z]{2}$/
// Keep in step with scripts/validate.mjs and docs/03-data-schema.md.
const SCHEMA_VERSION = 2

const USAGE = `
Scaffold a Dispatch Atlas region.

Usage:
  npm run new-region -- --id <region_id> --name "<Display name>" [options]
  npm run new-region -- --list
  npm run new-region -- --batch <file.json>

Required (unless --list / --batch):
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
  --center <lng,lat>   default map center                   (scaffold only)
  --zoom <n>           default map zoom                     (scaffold only, default: 11)
  --note "<text>"      why this region, or what to focus on
  --scaffold           also write an empty region .geojson to fill in
  --force              overwrite an existing entry / file
  --list               print the current queue and exit
  --batch <file.json>  queue many regions at once; the file is a JSON array of
                       objects with the same keys as the flags above
  --help               show this

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

  # queue a whole batch
  npm run new-region -- --batch regions-wanted.json
`

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) die(`unexpected argument "${token}" (see --help)`)
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i++
    }
  }
  return args
}

function die(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, value) => writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`)

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

/** An empty region file that already passes `npm run validate`. */
function emptyRegion(spec) {
  return {
    type: 'FeatureCollection',
    metadata: {
      region_id: spec.id,
      name: spec.name,
      country: spec.country,
      game_edition: spec.edition,
      center: spec.center,
      zoom: spec.zoom,
      subregions: [],
      generated_by: 'agent',
      generated_at: new Date().toISOString().slice(0, 10),
      schema_version: SCHEMA_VERSION,
    },
    features: [],
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

  const scaffold = raw.scaffold === true || raw.scaffold === 'true'
  // A published entry with no data file would break the app's region picker.
  if (status === 'published' && !scaffold && !existsSync(join(REGIONS_DIR, `${id}.geojson`))) {
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
    center: raw.center ? parseCenter(raw.center) : [0, 0],
    zoom: raw.zoom === undefined ? 11 : Number(raw.zoom),
  }
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
    }
  }
  console.log()
}

/** Add or replace one registry entry + optional data file. Returns a summary. */
function addRegion(index, spec, force) {
  const existing = index.regions.findIndex((r) => r.region_id === spec.id)
  if (existing !== -1 && !force) {
    die(`"${spec.id}" is already in ${INDEX_PATH} (use --force to replace it)`)
  }

  const filePath = join(REGIONS_DIR, `${spec.id}.geojson`)
  const hasFile = existsSync(filePath)
  let wroteFile = false

  if (spec.scaffold) {
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
  if (spec.note) entry.note = spec.note

  if (existing === -1) index.regions.push(entry)
  else index.regions[existing] = entry

  return { entry, wroteFile, replaced: existing !== -1 }
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
}

writeJson(INDEX_PATH, index)
console.log(`\nRegistry written: ${INDEX_PATH}`)

const needsData = specs.filter((s) => s.status !== 'published')
if (needsData.length > 0) {
  console.log(
    `\nNext: generate the data per docs/06-data-generation-agent.md, then run \`npm run validate\`.`,
  )
}
