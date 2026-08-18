// Shared ground between the scripts that own data/regions: where things live,
// JSON I/O in the one format the repo commits, and the two derived values a
// registry entry duplicates out of a region file.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const REGIONS_DIR = 'data/regions'
export const INDEX_FILE = 'index.json'
/** Composite regions live one directory down, so the flat *.geojson scan — and
 *  the app's import.meta.glob — keep seeing exactly the merged region files. */
export const PARTS_DIR = 'parts'
export const MANIFEST_FILE = 'region.json'
/** Current data schema version (docs/03-data-schema.md). Single definition;
 *  scripts/validate.mjs and scripts/new-region.mjs both read it from here. */
export const SCHEMA_VERSION = 2

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
export const writeJson = (p, value) => writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`)

export const indexPath = (dir = REGIONS_DIR) => join(dir, INDEX_FILE)
export const regionPath = (regionId, dir = REGIONS_DIR) => join(dir, `${regionId}.geojson`)
export const partsDir = (regionId, dir = REGIONS_DIR) => join(dir, PARTS_DIR, regionId)
export const manifestPath = (regionId, dir = REGIONS_DIR) =>
  join(partsDir(regionId, dir), MANIFEST_FILE)
export const partPath = (regionId, partId, dir = REGIONS_DIR) =>
  join(partsDir(regionId, dir), `${partId}.geojson`)

/** The region_ids that are generated in parts, in stable order. */
export function compositeRegionIds(dir = REGIONS_DIR) {
  const root = join(dir, PARTS_DIR)
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

/**
 * Copy the global-map pin fields (docs/05) out of a region file onto its
 * registry entry. They duplicate the data file so the landing view can plot
 * every region without downloading one, and `npm run validate` fails when the
 * two disagree — so every writer of index.json goes through here.
 */
export function applyPins(entry, region) {
  const center = region?.metadata?.center
  if (center) entry.center = center
  if (region) entry.facility_count = region.features?.length ?? 0
  return entry
}

/** The given sub-region id plus every id beneath it. Mirrors src/lib/subregions.ts. */
export function subtreeIds(subregions, rootId) {
  const childrenOf = new Map()
  for (const sub of subregions) {
    if (sub.parent == null) continue
    childrenOf.set(sub.parent, [...(childrenOf.get(sub.parent) ?? []), sub.id])
  }
  const ids = new Set()
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.pop()
    if (ids.has(id)) continue
    ids.add(id)
    queue.push(...(childrenOf.get(id) ?? []))
  }
  return ids
}
