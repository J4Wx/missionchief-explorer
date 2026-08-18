/* AUTO-GENERATED from schemas/*.json by scripts/gen-types.mjs.
   Do not edit by hand — run `npm run gen:types` instead. */

/**
 * A GeoJSON FeatureCollection of facilities for one region.
 */
export interface RegionFeatureCollection {
  type: 'FeatureCollection'
  metadata: {
    /**
     * Globally unique region slug, e.g. us-ga-savannah.
     */
    region_id: string
    name: string
    /**
     * ISO 3166-1 alpha-2 of the region itself, e.g. US, GB (not UK). Must match the region_id prefix.
     */
    country: string
    /**
     * ISO 3166-1 alpha-2 of the Mission Chief edition this region's `game` blocks are written against (US = missionchief.com, GB = missionchief.co.uk). Usually the same as `country`. See docs/02-domain-model.md § Editions.
     */
    game_edition?: string
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
       * Kind of local division, for labeling/grouping in the UI. `township`/`precinct` are US divisions; `ward`/`unitary_authority` UK; `commune`/`province`/`region` cover most of Europe.
       */
      level?:
        | 'borough'
        | 'county'
        | 'unitary_authority'
        | 'municipality'
        | 'district'
        | 'township'
        | 'commune'
        | 'ward'
        | 'precinct'
        | 'sector'
        | 'region'
        | 'province'
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
  /**
   * Controlled vocabulary; see docs/02-domain-model.md. Some values are specific to a country's structure: sheriff/state_le/federal_le describe the US tiers, police_national covers countries whose national forces sit directly above local ones.
   */
  category:
    | 'fire'
    | 'ems'
    | 'police_local'
    | 'sheriff'
    | 'state_le'
    | 'federal_le'
    | 'police_national'
    | 'hospital'
    | 'clinic'
    | 'prison'
    | 'jail'
    | 'tow'
    | 'dispatch'
    | 'coast_guard'
    | 'sea_rescue'
    | 'mountain_rescue'
    | 'civil_protection'
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
      | 'national_police'
      | 'state_agency'
      | 'federal_agency'
      | 'ems_agency'
      | 'hospital_system'
      | 'corrections'
      | 'military'
      | 'rescue_service'
      | 'aid_organization'
      | 'private'
      | 'other'
    /**
     * Tier of government the agency answers to. `state`/`federal` are the US tiers; `regional`/`national` cover countries with no state layer (e.g. an NHS ambulance trust is `regional`, HM Prison Service `national`).
     */
    level?: 'municipal' | 'district' | 'county' | 'regional' | 'state' | 'national' | 'federal' | 'private' | 'other'
    parent?: string | null
  }
  designation?: string | null
  /**
   * At least city + country. `state` and `county` are the first- and second-level administrative areas; many countries have no first level, so `state` is optional (schema_version 2).
   */
  address: {
    street?: string
    /**
     * Town/city as locally addressed (a UK post town, a US city).
     */
    city: string
    /**
     * Second-level administrative area: US county, UK county or unitary authority, German Kreis.
     */
    county?: string
    /**
     * First-level administrative area where one exists: US state, German Land, Australian state. Omit for countries that have none (the UK addresses by post town + postcode).
     */
    state?: string
    postal_code?: string
    /**
     * ISO 3166-1 alpha-2, e.g. US, GB (not UK), DE.
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
   * Controlled capability tags, e.g. hazmat, swat. Trauma capability uses the country-neutral tiers `trauma_major`/`trauma_unit` so hospitals filter across regions; the country's own designation (ACS `trauma_level_1`, a UK Major Trauma Centre) is named in attributes.trauma_designation. See docs/02-domain-model.md.
   */
  specialties?: string[]
  /**
   * Category-specific structured extras (hospital beds/trauma_designation, jail capacity/security_level, etc.). Loosely validated on purpose — see docs/03-data-schema.md for the conventional keys.
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
