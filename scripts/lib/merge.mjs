// Assembling a region that is generated in parts (docs/06 § Regions generated
// in parts). One borough per file, one merged region file out — deterministic,
// because `npm run validate` re-runs this merge in memory and fails when the
// committed file disagrees with the parts it claims to be made of.
import { existsSync, readdirSync } from 'node:fs'
import { partPath, partsDir, manifestPath, readJson, REGIONS_DIR } from './regions.mjs'

/**
 * Read a composite region's manifest and whatever part files exist.
 * Throws only if the manifest itself can't be read — a part that is missing
 * (still queued) or unparseable is reported, not fatal, so the caller can say
 * which one it was.
 */
export function loadComposite(regionId, dir = REGIONS_DIR) {
  const manifest = readJson(manifestPath(regionId, dir))
  const parts = new Map()
  const missing = []
  const unreadable = []

  for (const part of manifest.parts ?? []) {
    const path = partPath(regionId, part.id, dir)
    if (!existsSync(path)) {
      missing.push(part.id)
      continue
    }
    try {
      parts.set(part.id, readJson(path))
    } catch (err) {
      unreadable.push({ id: part.id, message: err.message })
    }
  }

  const listed = new Set((manifest.parts ?? []).map((p) => `${p.id}.geojson`))
  const stray = readdirSync(partsDir(regionId, dir))
    .filter((f) => f.endsWith('.geojson') && !listed.has(f))
    .sort()

  return { manifest, parts, missing, unreadable, stray }
}

/**
 * Manifest + part files → the merged region FeatureCollection.
 *
 * A pure function of its inputs, deliberately: the merged file is committed
 * (the app bundles data/regions/*.geojson as-is, and PR previews build from the
 * tree), so the only thing keeping it honest is that re-merging reproduces it
 * byte for byte. Nothing here may read the clock or the filesystem.
 *
 * Order is manifest order, which is also what keeps parallel borough PRs from
 * conflicting: each part's facilities land in one contiguous block.
 */
export function mergeRegion(manifest, parts) {
  const meta = manifest.metadata ?? {}
  const subregions = [...(meta.subregions ?? [])]
  const features = []
  const included = []
  const pending = []
  // Provenance of the merge is the freshest thing that went into it.
  let generatedAt = meta.generated_at

  for (const part of manifest.parts ?? []) {
    const data = parts.get(part.id)
    if (!data) {
      pending.push(part.id)
      continue
    }
    included.push(part.id)
    subregions.push(...(data.part?.subregions ?? []))
    features.push(...(data.features ?? []))
    const at = data.part?.generated_at
    if (at && (!generatedAt || at > generatedAt)) generatedAt = at
  }

  const region = {
    type: 'FeatureCollection',
    metadata: {
      region_id: meta.region_id,
      name: meta.name,
      country: meta.country,
      ...(meta.game_edition ? { game_edition: meta.game_edition } : {}),
      center: meta.center,
      zoom: meta.zoom,
      subregions,
      ...(meta.generated_by ? { generated_by: meta.generated_by } : {}),
      ...(generatedAt ? { generated_at: generatedAt } : {}),
      schema_version: meta.schema_version,
    },
    features,
  }

  return { region, included, pending }
}

/** Whether a committed merged file still matches what its parts produce. */
export function isInSync(committed, merged) {
  return JSON.stringify(committed) === JSON.stringify(merged)
}
