// Tests for the data validator. Each case writes a throwaway regions directory
// — a registry plus one or more region files — and runs the real script over it
// as a subprocess, so what is under test is exactly what CI runs.
//
// Fixtures are built by mutating a known-good base rather than kept as files on
// disk: a broken fixture is only meaningful next to the valid one it differs
// from, and inlining the difference makes each test say what it breaks.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mergeRegion } from './lib/merge.mjs'

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
  center: [-81.09, 32.08],
  facility_count: 1,
  status: 'published',
})

const dirs = []

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

/**
 * The registry to use when a case doesn't state one: `validEntry()`, with its
 * pin fields taken from the region file the case actually wrote. They are
 * validated against that file, so a case about something else — a duplicate
 * facility, say — shouldn't have to restate them to stay valid.
 */
function defaultIndex(files) {
  const entry = validEntry()
  const region = files[entry.file]
  return {
    schema_version: 2,
    regions: [
      region
        ? { ...entry, center: region.metadata.center, facility_count: region.features.length }
        : entry,
    ],
  }
}

/**
 * Write a regions directory and run the validator over it.
 * `regions` maps a filename to its contents; `index` is the registry.
 */
function run({ index, regions, parts } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-atlas-validate-'))
  dirs.push(dir)
  const files = regions ?? { 'us-ga-testville.geojson': validRegion() }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index ?? defaultIndex(files)))
  for (const [file, data] of Object.entries(files)) {
    writeFileSync(join(dir, file), JSON.stringify(data))
  }

  // A region generated in parts keeps its manifest and part files one level
  // down, in parts/<region_id>/ — which is also what keeps them out of the flat
  // *.geojson scan the validator and the app both do over region files.
  for (const [regionId, partFiles] of Object.entries(parts ?? {})) {
    const partDir = join(dir, 'parts', regionId)
    mkdirSync(partDir, { recursive: true })
    for (const [file, data] of Object.entries(partFiles)) {
      writeFileSync(join(partDir, file), JSON.stringify(data))
    }
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

/**
 * The manifest of a region generated in parts: two districts, one generated and
 * one still queued — the normal mid-generation state.
 */
const validManifest = () => ({
  metadata: {
    region_id: 'us-ga-testville',
    name: 'Testville',
    country: 'US',
    center: [-81.09, 32.08],
    zoom: 11,
    subregions: [
      { id: 'downtown', name: 'Downtown', level: 'district', parent: null },
      { id: 'uptown', name: 'Uptown', level: 'district', parent: null },
    ],
    schema_version: 2,
  },
  parts: [
    { id: 'downtown', name: 'Downtown', subregion_id: 'downtown', status: 'published' },
    { id: 'uptown', name: 'Uptown', subregion_id: 'uptown', status: 'requested' },
  ],
})

/** One part file, holding a single facility in the division it covers. */
function validPart(id, { subregion_id = id, regionId = 'us-ga-testville', partId = id } = {}) {
  return {
    type: 'FeatureCollection',
    part: {
      region_id: regionId,
      part_id: partId,
      subregions: [],
      generated_at: '2026-08-18',
      schema_version: 2,
    },
    features: [validFacility({ id: `testville-${id}-1`, subregion_id })],
  }
}

/**
 * Write a composite region — manifest, part files, and the merged region file
 * the two produce — and validate it. `merged` mutates that merged file to
 * simulate drift, or is `null` for a region whose merge was never run.
 */
function runComposite({ manifest, parts, merged, extraPartFiles, index } = {}) {
  const spec = validManifest()
  manifest?.(spec)
  const partData = parts ?? { downtown: validPart('downtown') }

  // Cloned before any mutation, because the merge carries the part files' own
  // Feature objects through — on disk these are separate files, and a test
  // about editing the merged one must not reach back into its parts.
  const region = structuredClone(mergeRegion(spec, new Map(Object.entries(partData))).region)
  merged?.(region)
  const regions = merged === null ? {} : { 'us-ga-testville.geojson': region }

  const partFiles = { 'region.json': spec, ...extraPartFiles }
  for (const [id, data] of Object.entries(partData)) partFiles[`${id}.geojson`] = data

  const queued = { ...validEntry(), status: 'in_progress', center: spec.metadata.center }
  delete queued.file
  delete queued.facility_count

  return run({
    index: index ?? (merged === null ? { schema_version: 2, regions: [queued] } : defaultIndex(regions)),
    regions,
    parts: { 'us-ga-testville': partFiles },
  })
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

  // The registry carries each region's pin so the global map can plot them all
  // without loading a single region file — which only holds up if the copy
  // can't drift from the file it was copied from.
  describe('global-map pins', () => {
    it('rejects a published entry with no center', () => {
      const entry = validEntry()
      delete entry.center
      const { code, output } = run({ index: { schema_version: 2, regions: [entry] } })
      expect(code).toBe(1)
      expect(output).toContain('is published but has no `center`')
    })

    it('rejects a center that disagrees with the region file', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), center: [-79.95, 32.85] }] },
      })
      expect(code).toBe(1)
      expect(output).toContain('disagrees with us-ga-testville.geojson')
    })

    it('rejects a center that is not [lng, lat]', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), center: [-81.09] }] },
      })
      expect(code).toBe(1)
      expect(output).toContain('center must be [lng, lat]')
    })

    it('rejects a center outside the world', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), center: [-181, 32.08] }] },
      })
      expect(code).toBe(1)
      expect(output).toContain('is out of range')
    })

    it('rejects a facility_count that disagrees with the region file', () => {
      const { code, output } = run({
        index: { schema_version: 2, regions: [{ ...validEntry(), facility_count: 42 }] },
      })
      expect(code).toBe(1)
      expect(output).toContain('facility_count 42 disagrees with us-ga-testville.geojson (1)')
    })

    it('warns — but passes — when a published entry has no facility_count', () => {
      const entry = validEntry()
      delete entry.facility_count
      const { code, output } = run({ index: { schema_version: 2, regions: [entry] } })
      expect(code).toBe(0)
      expect(output).toContain('has no facility_count')
    })

    it('allows a queued region to carry a center before it has data', () => {
      const { code } = run({
        index: {
          schema_version: 2,
          regions: [
            validEntry(),
            {
              region_id: 'us-tx-austin',
              name: 'Austin',
              country: 'US',
              status: 'requested',
              center: [-97.74, 30.27],
            },
          ],
        },
      })
      expect(code).toBe(0)
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
              center: [-81.09, 32.08],
              facility_count: 1,
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

  // A region generated in parts (docs/06) is the same data arriving in pieces:
  // the manifest owns the metadata, one file per borough owns the facilities,
  // and the region file the app loads is generated from both. These are the
  // rules that make generating a borough at a time safe.
  describe('regions generated in parts', () => {
    it('passes a composite region whose merged file is up to date', () => {
      const { code, output } = runComposite()
      expect(code).toBe(0)
      expect(output).toContain('parts/us-ga-testville (1/2 parts merged, 1 pending)')
    })

    it('rejects a merged file that has drifted from its parts', () => {
      const { code, output } = runComposite({
        merged: (region) => region.features.pop(),
      })
      expect(code).toBe(1)
      expect(output).toContain('is out of date with its 1 part(s)')
      expect(output).toContain('npm run merge-region -- --id us-ga-testville')
    })

    it('rejects a merged file edited by hand rather than re-merged', () => {
      const { code, output } = runComposite({
        merged: (region) => {
          region.features[0].properties.name = 'Renamed in the merged file'
        },
      })
      expect(code).toBe(1)
      expect(output).toContain('is out of date')
    })

    it('rejects a composite region with no merged file at all', () => {
      const { code, output } = runComposite({ merged: null })
      expect(code).toBe(1)
      expect(output).toContain('has no merged region file')
    })

    it('rejects a part file the manifest does not list', () => {
      const { code, output } = runComposite({
        extraPartFiles: { 'harlem.geojson': validPart('harlem') },
      })
      expect(code).toBe(1)
      expect(output).toContain('harlem.geojson] is not listed in region.json')
    })

    it('rejects the same facility appearing in two parts', () => {
      const uptown = validPart('uptown', { subregion_id: 'uptown' })
      uptown.features[0].properties.id = validPart('downtown').features[0].properties.id
      const { code, output } = runComposite({ parts: { downtown: validPart('downtown'), uptown } })
      expect(code).toBe(1)
      expect(output).toContain('is also in part "downtown"')
    })

    it('rejects a facility that belongs to another part’s sub-region', () => {
      const { code, output } = runComposite({
        parts: { downtown: validPart('downtown', { subregion_id: 'uptown' }) },
      })
      expect(code).toBe(1)
      expect(output).toContain('outside part "downtown"')
    })

    it('warns — but passes — on a facility with no sub-region at all', () => {
      const { code, output } = runComposite({
        parts: { downtown: validPart('downtown', { subregion_id: null }) },
      })
      expect(code).toBe(0)
      expect(output).toContain('has no subregion_id')
    })

    it('accepts a part nesting its own divisions under the one it covers', () => {
      const part = validPart('downtown', { subregion_id: 'riverside' })
      part.part.subregions = [
        { id: 'riverside', name: 'Riverside', level: 'neighborhood', parent: 'downtown' },
      ]
      const { code } = runComposite({ parts: { downtown: part } })
      expect(code).toBe(0)
    })

    it('rejects a part declaring a top-level division of its own', () => {
      const part = validPart('downtown')
      part.part.subregions = [{ id: 'westside', name: 'Westside', parent: null }]
      const { code, output } = runComposite({ parts: { downtown: part } })
      expect(code).toBe(1)
      expect(output).toContain('a part may only nest divisions inside')
    })

    it('rejects a part re-declaring a division the manifest owns', () => {
      const part = validPart('downtown')
      part.part.subregions = [{ id: 'uptown', name: 'Uptown again', parent: 'downtown' }]
      const { code, output } = runComposite({ parts: { downtown: part } })
      expect(code).toBe(1)
      expect(output).toContain('is already declared in region.json')
    })

    it('rejects a part covering a sub-region nobody declared', () => {
      const { code, output } = runComposite({
        manifest: (m) => {
          m.parts[0].subregion_id = 'nowhere'
        },
      })
      expect(code).toBe(1)
      expect(output).toContain('covers undeclared sub-region "nowhere"')
    })

    it('rejects a part marked published with no file', () => {
      const { code, output } = runComposite({ parts: {} })
      expect(code).toBe(1)
      expect(output).toContain('part "downtown" is published but downtown.geojson does not exist')
    })

    it('allows a part still queued with no file', () => {
      const { code, output } = runComposite()
      expect(code).toBe(0)
      expect(output).not.toContain('uptown.geojson does not exist')
    })

    it('rejects a manifest whose region_id disagrees with its directory', () => {
      const { code, output } = runComposite({
        manifest: (m) => {
          m.metadata.region_id = 'us-ga-elsewhere'
        },
      })
      expect(code).toBe(1)
      expect(output).toContain('disagrees with the directory name')
    })

    it('rejects a part file whose part_id disagrees with its filename', () => {
      const { code, output } = runComposite({
        parts: { downtown: validPart('downtown', { partId: 'somewhere-else' }) },
      })
      expect(code).toBe(1)
      expect(output).toContain('part.part_id "somewhere-else" disagrees with the filename')
    })

    it('rejects a part claiming to belong to another region', () => {
      const { code, output } = runComposite({
        parts: { downtown: validPart('downtown', { regionId: 'us-ga-elsewhere' }) },
      })
      expect(code).toBe(1)
      expect(output).toContain('disagrees with the region it sits under')
    })

    it('still applies the whole facility rule set, via the merged file', () => {
      // The country-specific rules run over the merged region, which is where
      // the region's own country lives — a part file has no country of its own.
      const part = validPart('downtown')
      part.features[0].properties.address.country = 'GB'
      part.features[0].properties.specialties = ['trauma_level_1']
      const { code, output } = runComposite({ parts: { downtown: part } })
      expect(code).toBe(1)
      expect(output).toContain('[us-ga-testville.geojson] facility')
      expect(output).toContain('carries ACS-only trauma_level_1')
    })
  })
})
