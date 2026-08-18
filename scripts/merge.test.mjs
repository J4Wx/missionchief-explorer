// Tests for the part merge. The merged region file is committed and the
// validator re-runs this merge to check it hasn't drifted, so what matters here
// is that the output is a pure, stable function of manifest + parts.
import { describe, expect, it } from 'vitest'
import { isInSync, mergeRegion } from './lib/merge.mjs'

const manifest = (over = {}) => ({
  metadata: {
    region_id: 'us-ny-testcity',
    name: 'Testcity',
    country: 'US',
    game_edition: 'US',
    center: [-73.97, 40.7],
    zoom: 10,
    subregions: [
      { id: 'north', name: 'North', level: 'borough', parent: null },
      { id: 'south', name: 'South', level: 'borough', parent: null },
    ],
    generated_by: 'agent',
    generated_at: '2026-01-01',
    schema_version: 2,
  },
  parts: [
    { id: 'north', name: 'North', subregion_id: 'north', status: 'published' },
    { id: 'south', name: 'South', subregion_id: 'south', status: 'published' },
  ],
  ...over,
})

const part = (id, facilityIds, over = {}) => ({
  type: 'FeatureCollection',
  part: { region_id: 'us-ny-testcity', part_id: id, schema_version: 2, ...over },
  features: facilityIds.map((fid) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-73.97, 40.7] },
    properties: { id: fid, subregion_id: id },
  })),
})

const parts = (...entries) => new Map(entries.map((p) => [p.part.part_id, p]))

describe('mergeRegion', () => {
  it('concatenates parts in manifest order, not the order they were generated', () => {
    const { region, included } = mergeRegion(
      manifest(),
      parts(part('south', ['s1']), part('north', ['n1', 'n2'])),
    )
    expect(included).toEqual(['north', 'south'])
    expect(region.features.map((f) => f.properties.id)).toEqual(['n1', 'n2', 's1'])
  })

  it('carries the manifest metadata onto the merged file', () => {
    const { region } = mergeRegion(manifest(), parts(part('north', ['n1'])))
    expect(region.type).toBe('FeatureCollection')
    expect(region.metadata).toMatchObject({
      region_id: 'us-ny-testcity',
      country: 'US',
      game_edition: 'US',
      center: [-73.97, 40.7],
      zoom: 10,
      schema_version: 2,
    })
  })

  it('skips a part that has no file yet and reports it as pending', () => {
    const { region, included, pending } = mergeRegion(manifest(), parts(part('north', ['n1'])))
    expect(included).toEqual(['north'])
    expect(pending).toEqual(['south'])
    expect(region.features).toHaveLength(1)
  })

  it('produces an empty but complete region when no part exists yet', () => {
    const { region, pending } = mergeRegion(manifest(), new Map())
    expect(region.features).toEqual([])
    expect(region.metadata.subregions).toHaveLength(2)
    expect(pending).toEqual(['north', 'south'])
  })

  it('appends the sub-regions a part declares after the region-wide ones', () => {
    const nested = part('north', ['n1'])
    nested.part.subregions = [
      { id: 'north-hill', name: 'North Hill', level: 'neighborhood', parent: 'north' },
    ]
    const { region } = mergeRegion(manifest(), parts(nested))
    expect(region.metadata.subregions.map((s) => s.id)).toEqual(['north', 'south', 'north-hill'])
  })

  it('dates the merge from the freshest thing that went into it', () => {
    const { region } = mergeRegion(
      manifest(),
      parts(
        part('north', ['n1'], { generated_at: '2026-03-04' }),
        part('south', ['s1'], { generated_at: '2026-02-01' }),
      ),
    )
    expect(region.metadata.generated_at).toBe('2026-03-04')
  })

  it('keeps the manifest date when it is newer than every part', () => {
    const { region } = mergeRegion(
      manifest({ metadata: { ...manifest().metadata, generated_at: '2026-09-09' } }),
      parts(part('north', ['n1'], { generated_at: '2026-03-04' })),
    )
    expect(region.metadata.generated_at).toBe('2026-09-09')
  })

  it('is deterministic — the same inputs merge to the same file', () => {
    const inputs = () => [manifest(), parts(part('north', ['n1']), part('south', ['s1']))]
    const a = mergeRegion(...inputs()).region
    const b = mergeRegion(...inputs()).region
    expect(isInSync(a, b)).toBe(true)
  })

  it('sees a hand-edited region file as out of sync', () => {
    const { region } = mergeRegion(manifest(), parts(part('north', ['n1'])))
    const edited = structuredClone(region)
    edited.features[0].properties.id = 'edited-by-hand'
    expect(isInSync(edited, region)).toBe(false)
  })
})
