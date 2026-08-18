// Tests for `npm run new-region -- --sync`, the one path in this script that
// exists to be run *after* a region file changes: a depth pass edits a
// published region in place, and the registry's copies of its pin and review
// date have to follow (docs/06 § Depth passes).
//
// The script resolves data/ and schemas/ relative to the working directory, so
// each case builds a throwaway tree and runs the real script inside it.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve('scripts/new-region.mjs')
const SCHEMAS = resolve('schemas')

const region = (over = {}) => ({
  type: 'FeatureCollection',
  metadata: {
    region_id: 'us-ga-testville',
    name: 'Testville',
    country: 'US',
    center: [-81.09, 32.08],
    zoom: 11,
    generated_at: '2026-08-01',
    last_reviewed: '2026-08-01',
    schema_version: 2,
    ...over,
  },
  features: [],
})

const entry = (over = {}) => ({
  region_id: 'us-ga-testville',
  name: 'Testville',
  country: 'US',
  file: 'us-ga-testville.geojson',
  center: [-81.09, 32.08],
  facility_count: 0,
  last_reviewed: '2026-08-01',
  status: 'published',
  ...over,
})

const dirs = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

/** A working tree with one region, run through `--sync`. */
function run({ index, regions } = {}, flags = ['--sync']) {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-atlas-new-region-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'data', 'regions'), { recursive: true })
  symlinkSync(SCHEMAS, join(dir, 'schemas'), 'dir')

  const files = regions ?? { 'us-ga-testville.geojson': region() }
  writeFileSync(
    join(dir, 'data/regions/index.json'),
    JSON.stringify({ schema_version: 2, regions: index ?? [entry()] }, null, 2),
  )
  for (const [file, data] of Object.entries(files)) {
    writeFileSync(join(dir, 'data/regions', file), JSON.stringify(data, null, 2))
  }

  const { status, stdout, stderr } = spawnSync('node', [SCRIPT, ...flags], {
    cwd: dir,
    encoding: 'utf8',
  })
  const written = JSON.parse(readFileSync(join(dir, 'data/regions/index.json'), 'utf8'))
  return { code: status, out: `${stdout}${stderr}`, index: written }
}

describe('new-region --sync', () => {
  it('picks up a review date bumped by a depth pass', () => {
    const reviewed = region({ last_reviewed: '2026-08-18' })
    const { code, index } = run({ regions: { 'us-ga-testville.geojson': reviewed } })
    expect(code).toBe(0)
    expect(index.regions[0].last_reviewed).toBe('2026-08-18')
  })

  it('picks up facilities the pass added', () => {
    const grown = region()
    grown.features = [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-81.09, 32.08] },
        properties: { id: 'a' },
      },
    ]
    const { index } = run({ regions: { 'us-ga-testville.geojson': grown } })
    expect(index.regions[0].facility_count).toBe(1)
  })

  it('clears a review date the region file no longer claims', () => {
    // A stale mirrored date is worse than none: the app would rank the region
    // by a review that isn't recorded anywhere.
    const undated = region()
    delete undated.metadata.last_reviewed
    const { index } = run({ regions: { 'us-ga-testville.geojson': undated } })
    expect(index.regions[0].last_reviewed).toBeUndefined()
  })

  it('leaves a registry that already matches untouched', () => {
    const { code, out, index } = run()
    expect(code).toBe(0)
    expect(out).toContain('already matches')
    expect(index.regions[0]).toEqual(entry())
  })

  it('leaves queued entries alone — they have no file to copy from', () => {
    const queued = { region_id: 'us-tx-austin', name: 'Austin', country: 'US', status: 'requested' }
    const { index } = run({ index: [entry(), queued] })
    expect(index.regions[1]).toEqual(queued)
  })

  it('can sync a single region', () => {
    const other = {
      ...entry({ region_id: 'us-sc-other', name: 'Other', file: 'us-sc-other.geojson' }),
      last_reviewed: '2026-01-01',
    }
    const { index } = run({
      index: [entry(), other],
      regions: {
        'us-ga-testville.geojson': region({ last_reviewed: '2026-08-18' }),
        'us-sc-other.geojson': region({ region_id: 'us-sc-other', last_reviewed: '2026-08-18' }),
      },
    }, ['--sync', '--id', 'us-ga-testville'])
    expect(index.regions[0].last_reviewed).toBe('2026-08-18')
    expect(index.regions[1].last_reviewed).toBe('2026-01-01')
  })

  it('fails on a region id the registry has never heard of', () => {
    const { code, out } = run({}, ['--sync', '--id', 'us-zz-nowhere'])
    expect(code).toBe(1)
    expect(out).toContain('is not in')
  })
})
