// Assembles a region that is generated in parts — one file per borough under
// data/regions/parts/<region_id>/ — into the single data/regions/<region_id>.geojson
// the app loads, and syncs the registry's pin fields to match.
//
// The merged file is committed like any other region file; this script is the
// only thing that should ever write it. `npm run validate` re-runs the merge in
// memory and fails if the committed file has drifted from its parts.
//
// Run: npm run merge-region -- --help
import { existsSync, statSync } from 'node:fs'
import { isInSync, loadComposite, mergeRegion } from './lib/merge.mjs'
import { die, parseArgs } from './lib/cli.mjs'
import {
  REGIONS_DIR,
  applyPins,
  compositeRegionIds,
  indexPath,
  manifestPath,
  readJson,
  regionPath,
  writeJson,
} from './lib/regions.mjs'

// docs/04 § Performance: region files are the load unit, target < ~1–2 MB.
// Splitting generation doesn't split the payload — worth saying out loud on the
// regions big enough to need parts in the first place.
const SIZE_WARN_BYTES = 1_500_000

const USAGE = `
Merge a part-generated region into its region file.

Usage:
  npm run merge-region -- --id <region_id>
  npm run merge-region -- --all
  npm run merge-region -- --all --check

Options:
  --id <region_id>   the composite region to merge, e.g. us-ny-nyc
  --all              merge every region under data/regions/parts/
  --check            don't write; exit non-zero if a merged file is out of date
  --help             show this

Parts live in data/regions/parts/<region_id>/: region.json (the manifest, which
owns the region's metadata and lists the parts) plus one <part_id>.geojson per
part. A part listed as \`requested\` with no file yet is skipped, not an error —
the manifest is the borough-level request queue. See docs/06.
`

const args = parseArgs(process.argv.slice(2))
if (args.help || process.argv.length <= 2) {
  console.log(USAGE.trim())
  process.exit(0)
}

const check = args.check === true
const known = compositeRegionIds()

let targets
if (args.all === true) {
  targets = known
  if (targets.length === 0) die(`no composite regions found in ${REGIONS_DIR}/parts/`)
} else if (typeof args.id === 'string') {
  targets = [args.id]
  if (!existsSync(manifestPath(args.id))) {
    die(
      `"${args.id}" has no manifest at ${manifestPath(args.id)}\n` +
        `  known composite regions: ${known.length ? known.join(', ') : '(none)'}\n` +
        `  to start one: npm run new-region -- --id ${args.id} --name "…" --split --parts "…"`,
    )
  }
} else {
  die('pass --id <region_id> or --all (see --help)')
}

const index = readJson(indexPath())
let staleCount = 0
let wroteIndex = false

for (const regionId of targets) {
  const { manifest, parts, missing, unreadable, stray } = loadComposite(regionId)

  if (unreadable.length > 0) {
    die(`${regionId}: part ${unreadable[0].id} is not readable JSON — ${unreadable[0].message}`)
  }
  if (stray.length > 0) {
    die(
      `${regionId}: ${stray.join(', ')} ${stray.length === 1 ? 'is' : 'are'} not listed in the manifest — ` +
        'add the part with `npm run new-region -- --id ' + regionId + ' --part <id>` or delete the file',
    )
  }

  const { region, included, pending } = mergeRegion(manifest, parts)
  const target = regionPath(regionId)
  const committed = existsSync(target) ? readJson(target) : null
  const stale = !committed || !isInSync(committed, region)

  const summary =
    `${included.length}/${manifest.parts?.length ?? 0} parts, ${region.features.length} facilities` +
    (pending.length > 0 ? ` (pending: ${pending.join(', ')})` : '')

  if (check) {
    if (stale) {
      staleCount++
      console.error(`  ✗ ${regionId} is out of date — ${summary}`)
    } else {
      console.log(`  ✓ ${regionId} up to date — ${summary}`)
    }
    continue
  }

  writeJson(target, region)
  console.log(`  ✓ ${regionId} → ${target} (${summary})`)

  // Missing parts are the normal mid-generation state, but a silently short
  // region file is exactly the thing worth saying twice.
  if (missing.length > 0) {
    console.log(`    · ${missing.length} part(s) not generated yet: ${missing.join(', ')}`)
  }

  const bytes = statSync(target).size
  if (bytes > SIZE_WARN_BYTES) {
    console.warn(
      `    ! ${(bytes / 1e6).toFixed(1)} MB — over the ~1–2 MB per-region target in docs/04.\n` +
        '      The app loads a region as one file; parts split the generation, not the payload.',
    )
  }

  // Same bargain as `new-region`: the registry's center/facility_count are the
  // global map's pin and must not drift from the file (docs/05).
  const entry = index.regions?.find((r) => r.region_id === regionId)
  if (!entry) {
    console.warn(`    ! ${regionId} is not in ${indexPath()} — run \`npm run new-region\` to register it`)
  } else {
    entry.file = `${regionId}.geojson`
    applyPins(entry, region)
    wroteIndex = true
  }
}

if (check) {
  if (staleCount > 0) {
    console.error(`\n${staleCount} region file(s) out of date. Run \`npm run merge-region -- --all\`.`)
    process.exit(1)
  }
  console.log('\nAll part-generated region files are up to date.')
} else {
  if (wroteIndex) {
    writeJson(indexPath(), index)
    console.log(`\nRegistry written: ${indexPath()}`)
  }
  console.log('\nNext: `npm run validate`.')
}
