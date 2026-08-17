// Fixture builders for the app tests.
//
// Region files are large and every field is required somewhere, so tests build
// facilities from a minimal valid base and override only what the test is
// actually about. Keeping the base here (rather than importing a real region
// file) means a test asserts on the rule it names, not on Savannah's data.
import type { Facility, FacilityFeature, RegionIndexEntry, Subregion } from '../types/app'

let seq = 0

/** A schema-valid facility; `over` replaces any part of it. */
export function facility(over: Partial<Facility> = {}): Facility {
  seq += 1
  return {
    id: `facility-${seq}`,
    name: `Facility ${seq}`,
    category: 'fire',
    status: 'active',
    agency: { name: 'Test Fire Department' },
    address: { city: 'Savannah', state: 'GA', country: 'US' },
    units: [],
    game: { building_types: ['Fire Station'] },
    sources: [{ url: 'https://example.test/source' }],
    confidence: 'medium',
    ...over,
  }
}

/** A facility wrapped as the GeoJSON Feature the app actually passes around. */
export function feature(
  over: Partial<Facility> = {},
  coordinates: [number, number] = [-81.09, 32.08],
): FacilityFeature {
  return { type: 'Feature', geometry: { type: 'Point', coordinates }, properties: facility(over) }
}

export function subregion(over: Partial<Subregion> & Pick<Subregion, 'id'>): Subregion {
  return { name: over.id, ...over }
}

export function regionEntry(over: Partial<RegionIndexEntry> = {}): RegionIndexEntry {
  return {
    region_id: 'us-ga-savannah',
    name: 'Savannah',
    country: 'US',
    status: 'published',
    ...over,
  }
}
