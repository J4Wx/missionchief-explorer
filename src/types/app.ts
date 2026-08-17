// Hand-written app types that build on the schema-generated types in ./schema.
import type { RegionFeatureCollection } from './schema'

export type { Facility, RegionFeatureCollection } from './schema'

/** One facility Feature within a region file. */
export type FacilityFeature = RegionFeatureCollection['features'][number]

/** A declared sub-region (borough/district/municipality) within a region. */
export type Subregion = NonNullable<
  RegionFeatureCollection['metadata']['subregions']
>[number]

/** Shape of data/regions/index.json (the region registry — has no JSON Schema). */
export interface RegionIndex {
  schema_version: number
  regions: RegionIndexEntry[]
}

export interface RegionIndexEntry {
  region_id: string
  name: string
  country: string
  /**
   * First-level division the region sits in, as the code used in `region_id`
   * (`ga`, `mersey`). Optional: a region whose registry entry predates the
   * field, or one with no meaningful division, hangs straight off its country
   * in the picker.
   */
  admin?: string
  /** Display name for `admin` ("Georgia", "Merseyside"). */
  admin_name?: string
  /**
   * [lng, lat] the region sits at — its pin on the global map. Duplicated from
   * the region file's `metadata.center` so the default view can plot every
   * region without downloading all of them; `npm run validate` fails if the two
   * disagree, and requires it on a published entry.
   */
  center?: [number, number]
  /**
   * How many facilities the region file holds, for the global map's pin and the
   * region browser. Same bargain as `center`: duplicated to keep the landing
   * view cheap, kept honest by the validator.
   */
  facility_count?: number
  /**
   * Absent until the region has a data file. The registry doubles as the
   * request queue, so `requested` (and early `in_progress`) entries are
   * registered before anything exists to point at — see scripts/new-region.mjs.
   */
  file?: string
  status: 'requested' | 'in_progress' | 'published'
  note?: string
}
