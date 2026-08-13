/* AUTO-GENERATED from schemas/*.json by scripts/gen-types.mjs.
   Do not edit by hand — run `npm run gen:types` instead. */

/**
 * A GeoJSON FeatureCollection of facilities for one region.
 */
export interface RegionFeatureCollection {
  type: 'FeatureCollection'
  metadata: {
    /**
     * Globally unique region slug, e.g. us-il-springfield.
     */
    region_id: string
    name: string
    country: string
    /**
     * [lng, lat] default map center.
     *
     * @minItems 2
     * @maxItems 2
     */
    center: [unknown, unknown]
    zoom: number
    /**
     * Optional local-level divisions within the region (e.g. NYC boroughs, county municipalities, city districts). Facilities reference these via properties.subregion_id. May be nested via 'parent' to form a hierarchy.
     */
    subregions?: {
      /**
       * Unique-within-region subregion slug, e.g. manhattan.
       */
      id: string
      name: string
      /**
       * Kind of local division, for labeling/grouping in the UI.
       */
      level?:
        | 'borough'
        | 'county'
        | 'municipality'
        | 'district'
        | 'township'
        | 'precinct'
        | 'sector'
        | 'neighborhood'
        | 'other'
      /**
       * Optional id of a parent subregion (for nesting, e.g. neighborhood within borough). Must reference another subregion id.
       */
      parent?: string | null
      /**
       * Optional [lng, lat] to recenter the map when this subregion is selected.
       *
       * @minItems 2
       * @maxItems 2
       */
      center?: [unknown, unknown]
      zoom?: number
      /**
       * Optional [west, south, east, north] bounds.
       *
       * @minItems 4
       * @maxItems 4
       */
      bbox?: [number, number, number, number]
    }[]
    generated_by?: 'agent' | 'human'
    generated_at?: string
    schema_version: number
  }
  features: {
    type: 'Feature'
    geometry: {
      type: 'Point'
      /**
       * @minItems 2
       * @maxItems 2
       */
      coordinates: [unknown, unknown]
    }
    properties: Facility
  }[]
}
/**
 * A single emergency-services facility (the properties of a GeoJSON Feature).
 */
export interface Facility {
  /**
   * Kebab-case slug, unique within the region file.
   */
  id: string
  name: string
  category:
    | 'fire'
    | 'ems'
    | 'police_local'
    | 'sheriff'
    | 'state_le'
    | 'federal_le'
    | 'hospital'
    | 'clinic'
    | 'prison'
    | 'jail'
    | 'tow'
    | 'dispatch'
    | 'coast_guard'
    | 'ranger'
  subtype?: string
  /**
   * Optional. References the id of the most specific entry in the region's metadata.subregions (e.g. a borough/district/municipality). Enables local-level narrowing within a region.
   */
  subregion_id?: string | null
  status: 'active' | 'closed' | 'planned' | 'unknown'
  agency: {
    name: string
    type?:
      | 'fire_department'
      | 'police_department'
      | 'sheriff_office'
      | 'state_agency'
      | 'federal_agency'
      | 'ems_agency'
      | 'hospital_system'
      | 'corrections'
      | 'private'
      | 'other'
    level?: 'municipal' | 'county' | 'state' | 'federal' | 'private' | 'other'
    parent?: string | null
  }
  designation?: string | null
  address: {
    street?: string
    city: string
    county?: string
    state: string
    postal_code?: string
    /**
     * ISO 3166-1 alpha-2, e.g. US.
     */
    country: string
  }
  staffing_model?: 'career' | 'volunteer' | 'combination' | 'unknown'
  operating_hours?: '24_7' | 'daytime' | 'on_call' | 'unknown'
  units: {
    type:
      | 'engine'
      | 'ladder'
      | 'quint'
      | 'rescue'
      | 'tanker'
      | 'brush'
      | 'hazmat'
      | 'battalion'
      | 'air_light'
      | 'arff'
      | 'foam'
      | 'rehab'
      | 'ems_als'
      | 'ems_bls'
      | 'medic_chase'
      | 'mci'
      | 'marine'
      | 'dive'
      | 'air_support'
      | 'patrol'
      | 'swat'
      | 'k9'
      | 'mounted'
      | 'bomb_squad'
      | 'crime_scene'
      | 'traffic'
      | 'police_air'
      | 'police_marine'
      | 'tow_light'
      | 'tow_medium'
      | 'tow_heavy'
      | 'flatbed'
      | 'other'
    designation?: string
    count?: number
    attributes?: {}
  }[]
  /**
   * Controlled capability tags, e.g. hazmat, swat, trauma_level_1.
   */
  specialties?: string[]
  /**
   * Category-specific structured extras (hospital beds/trauma_level, jail capacity/security_level, etc.).
   */
  attributes?: {}
  game: {
    /**
     * @minItems 1
     */
    building_types: [string, ...string[]]
    recommended?: boolean
    notes?: string
  }
  significance?: string
  /**
   * @minItems 1
   */
  sources: [
    {
      title?: string
      url: string
      retrieved?: string
    },
    ...{
      title?: string
      url: string
      retrieved?: string
    }[]
  ]
  confidence: 'high' | 'medium' | 'low'
  last_verified?: string
}
