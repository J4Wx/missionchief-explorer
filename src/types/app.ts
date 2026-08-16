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
   * Absent until the region has a data file. The registry doubles as the
   * request queue, so `requested` (and early `in_progress`) entries are
   * registered before anything exists to point at — see scripts/new-region.mjs.
   */
  file?: string
  status: 'requested' | 'in_progress' | 'published'
  note?: string
}
