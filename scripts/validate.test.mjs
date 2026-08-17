// Tests for the data validator. Each case writes a throwaway regions directory
// — a registry plus one or more region files — and runs the real script over it
// as a subprocess, so what is under test is exactly what CI runs.
//
// Fixtures are built by mutating a known-good base rather than kept as files on
// disk: a broken fixture is only meaningful next to the valid one it differs
// from, and inlining the difference makes each test say what it breaks.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = 'scripts/validate.mjs'

/** A minimal region file that passes every rule. */
const validRegion = () => ({
  type: 'FeatureCollection',
  metadata: {
    region_id: 'us-ga-testville',
    name: 'Testville',
    country: 'US',
    center: [-81.09, 32.08],
    zoom: 11,
    subregions: [{ id: 'downtown', name: 'Downtown', parent: null }],
    schema_version: 2,
  },
  features: [validFacility()],
})

function validFacility(over = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-81.09, 32.08] },
    properties: {
      id: 'testville-station-1',
      name: 'Testville Fire Station 1',
      category: 'fire',
      subregion_id: 'downtown',
      status: 'active',
      agency: { name: 'Testville Fire Department' },
      address: { city: 'Testville', state: 'GA', country: 'US' },
      units: [],
      game: { building_types: ['Fire Station'] },
      sources: [{ url: 'https://example.test/roster' }],
      confidence: 'medium',
      ...over,
    },
  }
}

/** The registry entry matching `validRegion()`. */
const validEntry = () => ({
  region_id: 'us-ga-testville',
  name: 'Testville',
  country: 'US',
  admin: 'ga',
  admin_name: 'Georgia',
  file: 'us-ga-testville.geojson',
  status: 'published',
})

const dirs = []

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

/**
 * Write a regions directory and run the validator over it.
 * `regions` maps a filename to its contents; `index` is the registry.
 */
function run({ index = { schema_version: 2, regions: [validEntry()] }, regions } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-atlas-validate-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index))
  for (const [file, data] of Object.entries(regions ?? { 'us-ga-testville.geojson': validRegion() })) {
    writeFileSync(join(dir, file), JSON.stringify(data))
  }

  // Errors go to stderr and warnings to stdout's sibling stream, so both are
  // folded into one `output` — a test asserts on the message, not the channel.
  const { status, stdout, stderr } = spawnSync('node', [SCRIPT, dir], { encoding: 'utf8' })
  return { code: status, output: `${stdout}${stderr}` }
}

/** Run a case that differs from the valid base by one mutation of the region file. */
function runBroken(mutate) {
  const region = validRegion()
  mutate(region)
  return run({ regions: { 'us-ga-testville.geojson': region } })
}

describe('validate.mjs', () => {
  it('passes a valid region', () => {
    const { code, output } = run()
    expect(code).toBe(0)
    expect(output).toContain('All region data valid.')
    expect(output).toContain('us-ga-testville.geojson (1 facilities, 1 sub-regions)')
  })

  it('passes the real data directory', () => {
    const { code, output } = run({ index: undefined, regions: undefined })
    expect(code).toBe(0)
    expect(output).toContain('All region data valid.')
  })

  describe('JSON Schema', () => {
    it('rejects a facility missing a required field', () => {
      const { code, output } = runBroken((r) => delete r.features[0].properties.confidence)
      expect(code).toBe(1)
      expect(output).toMatch(/must have required property 'confidence'/)
      expect(output).toContain('Validation FAILED')
    })

    it('rejects a category outside the vocabulary', () => {
      const { code, output } = runBroken((r) => {
        r.features[0].properties.category = 'space_force'
      })
      expect(code).toBe(1)
      expect(output).toMatch(/must be equal to one of the allowed values/)
    })

    it('rejects a country that is not an ISO-2 code', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.country = 'USA'
      })
      expect(code).toBe(1)
      expect(output).toMatch(/must match pattern/)
    })

    it('reports every error rather than stopping at the first', () => {
      const { output } = runBroken((r) => {
        delete r.features[0].properties.confidence
        delete r.features[0].properties.name
      })
      expect(output).toMatch(/required property 'confidence'/)
      expect(output).toMatch(/required property 'name'/)
    })
  })

  describe('file and registry integrity', () => {
    it('rejects a filename that disagrees with region_id', () => {
      const region = validRegion()
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), file: 'wrong-name.geojson' }] },
        regions: { 'wrong-name.geojson': region },
      })
      expect(code).toBe(1)
      expect(output).toContain('filename should be "us-ga-testville.geojson"')
    })

    it('exempts the bundled example fixtures from the naming rule', () => {
      const { code } = run({
        index: {
          schema_version: 2,
          regions: [{ ...validEntry(), file: 'example-testville.geojson' }],
        },
        regions: { 'example-testville.geojson': validRegion() },
      })
      expect(code).toBe(0)
    })

    it('rejects a region file nobody registered', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [] },
        regions: { 'us-ga-testville.geojson': validRegion() },
      })
      expect(code).toBe(1)
      expect(output).toContain('not registered in')
    })

    it('rejects a registry entry pointing at a missing file', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), file: 'gone.geojson' }] },
        regions: { 'us-ga-testville.geojson': validRegion() },
      })
      expect(code).toBe(1)
      expect(output).toContain('points at missing file "gone.geojson"')
    })

    it('rejects a published entry with no file', () => {
      const entry = validEntry()
      delete entry.file
      const { code, output } = run({
        index: { schema_version: 2, regions: [entry] },
        regions: {},
      })
      expect(code).toBe(1)
      expect(output).toContain('is published but has no `file`')
    })

    it('allows a queued region with no file yet', () => {
      const { code } = run({
        index: {
          schema_version: 2,
          regions: [{ region_id: 'us-tx-austin', name: 'Austin', country: 'US', status: 'requested' }],
        },
        regions: {},
      })
      expect(code).toBe(0)
    })

    it('rejects a duplicate region_id in the registry', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [validEntry(), validEntry()] },
      })
      expect(code).toBe(1)
      expect(output).toContain('duplicate region_id in the registry')
    })

    it('rejects an unknown status', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), status: 'draft' }] },
      })
      expect(code).toBe(1)
      expect(output).toContain('status "draft" must be one of')
    })

    it('rejects an admin that disagrees with the region_id', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), admin: 'sc' }] },
      })
      expect(code).toBe(1)
      expect(output).toContain('admin "sc" disagrees with region_id (expected "ga")')
    })

    it('rejects admin_name without admin', () => {
      const entry = validEntry()
      delete entry.admin
      const { code, output } = run({ index: { schema_version: 2, regions: [entry] } })
      expect(code).toBe(1)
      expect(output).toContain('has admin_name but no admin')
    })

    it('warns — but passes — when admin has no admin_name', () => {
      const entry = validEntry()
      delete entry.admin_name
      const { code, output } = run({ index: { schema_version: 2, regions: [entry] } })
      expect(code).toBe(0)
      expect(output).toContain('but no admin_name')
      expect(output).toContain('(1 warning(s))')
    })
  })

  describe('schema version', () => {
    it('rejects a file newer than the validator knows', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.schema_version = 99
      })
      expect(code).toBe(1)
      expect(output).toContain('is newer than this validator knows')
    })

    it('warns — but passes — on an older file', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.schema_version = 1
      })
      expect(code).toBe(0)
      expect(output).toContain('schema_version 1 — current is 2')
    })
  })

  it('rejects a region_id prefix that disagrees with the country', () => {
    const { code, output } = run({
      index: {
        schema_version: 2,
        regions: [{ ...validEntry(), region_id: 'gb-ga-testville', file: 'gb-ga-testville.geojson' }],
      },
      regions: {
        'gb-ga-testville.geojson': {
          ...validRegion(),
          metadata: { ...validRegion().metadata, region_id: 'gb-ga-testville', country: 'US' },
        },
      },
    })
    expect(code).toBe(1)
    expect(output).toContain('starts with "gb-" but country is "US"')
  })

  describe('sub-regions', () => {
    it('rejects a duplicate sub-region id', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.subregions.push({ id: 'downtown', name: 'Downtown Again' })
      })
      expect(code).toBe(1)
      expect(output).toContain('duplicate subregion id "downtown"')
    })

    it('rejects an unresolved parent', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.subregions.push({ id: 'historic', name: 'Historic', parent: 'nowhere' })
      })
      expect(code).toBe(1)
      expect(output).toContain('unresolved parent "nowhere"')
    })

    it('rejects a self-parent', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.subregions.push({ id: 'historic', name: 'Historic', parent: 'historic' })
      })
      expect(code).toBe(1)
      expect(output).toContain('is its own parent')
    })

    it('rejects a parent cycle', () => {
      const { code, output } = runBroken((r) => {
        r.metadata.subregions = [
          { id: 'a', name: 'A', parent: 'b' },
          { id: 'b', name: 'B', parent: 'a' },
        ]
        r.features[0].properties.subregion_id = 'a'
      })
      expect(code).toBe(1)
      expect(output).toContain('subregion parent cycle')
    })

    it('accepts legitimate nesting', () => {
      const { code } = runBroken((r) => {
        r.metadata.subregions.push({ id: 'historic', name: 'Historic', parent: 'downtown' })
      })
      expect(code).toBe(0)
    })
  })

  describe('facilities', () => {
    it('rejects a duplicate facility id', () => {
      const { code, output } = runBroken((r) => r.features.push(validFacility()))
      expect(code).toBe(1)
      expect(output).toContain('duplicate facility id "testville-station-1"')
    })

    it('rejects out-of-range coordinates', () => {
      const { code, output } = runBroken((r) => {
        r.features[0].geometry.coordinates = [-181, 32.08]
      })
      expect(code).toBe(1)
      // Caught by the schema's own bounds before the explicit range check.
      expect(output).toMatch(/coordinates|>= -180/)
    })

    it('rejects an empty sources list', () => {
      const { code, output } = runBroken((r) => {
        r.features[0].properties.sources = []
      })
      expect(code).toBe(1)
      expect(output).toMatch(/sources|fewer than 1 items/)
    })

    it('rejects a reference to an unknown sub-region', () => {
      const { code, output } = runBroken((r) => {
        r.features[0].properties.subregion_id = 'nowhere'
      })
      expect(code).toBe(1)
      expect(output).toContain('references unknown subregion "nowhere"')
    })

    it('warns — but passes — on a facility across the region border', () => {
      const { code, output } = runBroken((r) => {
        r.features[0].properties.address = { city: 'Hardeeville', state: 'SC', country: 'CA' }
      })
      expect(code).toBe(0)
      expect(output).toContain('is in CA but the region is US')
    })
  })

  describe('ACS trauma levels outside the US', () => {
    const nonUsRegion = () => ({
      ...validRegion(),
      metadata: {
        ...validRegion().metadata,
        region_id: 'gb-mersey-testville',
        country: 'GB',
        subregions: [{ id: 'downtown', name: 'City Centre', parent: null }],
      },
      features: [
        validFacility({
          category: 'hospital',
          address: { city: 'Liverpool', country: 'GB' },
          game: { building_types: ['Hospital'] },
        }),
      ],
    })

    const runNonUs = (mutate) => {
      const region = nonUsRegion()
      mutate(region.features[0].properties)
      return run({
        index: {
          schema_version: 2,
          regions: [
            {
              region_id: 'gb-mersey-testville',
              name: 'Testville',
              country: 'GB',
              admin: 'mersey',
              admin_name: 'Merseyside',
              file: 'gb-mersey-testville.geojson',
              status: 'published',
            },
          ],
        },
        regions: { 'gb-mersey-testville.geojson': region },
      })
    }

    it('rejects an ACS specialty tag', () => {
      const { code, output } = runNonUs((p) => {
        p.specialties = ['trauma_level_1']
      })
      expect(code).toBe(1)
      expect(output).toContain('carries ACS-only trauma_level_1')
    })

    it('rejects the ACS numeric attribute', () => {
      const { code, output } = runNonUs((p) => {
        p.attributes = { trauma_level: 1 }
      })
      expect(code).toBe(1)
      expect(output).toContain('sets attributes.trauma_level')
    })

    it('accepts the country-neutral tier plus a local designation', () => {
      const { code } = runNonUs((p) => {
        p.specialties = ['trauma_major']
        p.attributes = { trauma_designation: 'Major Trauma Centre' }
      })
      expect(code).toBe(0)
    })

    it('still allows ACS levels on US records', () => {
      const { code } = runBroken((r) => {
        r.features[0].properties.category = 'hospital'
        r.features[0].properties.specialties = ['trauma_level_1']
        r.features[0].properties.attributes = { trauma_level: 1 }
      })
      expect(code).toBe(0)
    })
  })

  it('counts every error before failing', () => {
    const { code, output } = runBroken((r) => {
      r.features.push(validFacility())
      r.metadata.subregions.push({ id: 'downtown', name: 'Dupe' })
    })
    expect(code).toBe(1)
    expect(output).toContain('Validation FAILED with 2 error(s).')
  })
})
