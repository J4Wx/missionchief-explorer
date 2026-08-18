// Tests for the coverage report (docs/07 Phase 8).
//
// Two halves, for two reasons. The metric functions in lib/coverage.mjs are
// pure, so they're asserted directly — that is where the counting rules live
// (what counts as a unit-bearing category, how a hospital with no trauma key
// differs from one stated as none). The CLI is run as a subprocess against a
// throwaway regions directory, because the thing worth pinning about it is the
// contract with CI: it reports, and it never fails.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ageInDays, byReviewAge, regionCoverage, totalCoverage } from './lib/coverage.mjs'

const SCRIPT = 'scripts/report.mjs'
const AS_OF = '2026-08-18'

function facility(over = {}) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-81.09, 32.08] },
    properties: {
      id: 'testville-station-1',
      name: 'Testville Fire Station 1',
      category: 'fire',
      status: 'active',
      agency: { name: 'Testville Fire Department' },
      address: { city: 'Testville', state: 'GA', country: 'US' },
      units: [],
      specialties: [],
      sources: [{ url: 'https://example.test/roster' }],
      confidence: 'medium',
      ...over,
    },
  }
}

const region = (over = {}, features = [facility()]) => ({
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
  features,
})

describe('regionCoverage', () => {
  it('counts unit coverage per category, and fire/EMS as the headline', () => {
    const report = regionCoverage(
      region({}, [
        facility({ id: 'a', units: [{ type: 'engine' }] }),
        facility({ id: 'b' }),
        facility({ id: 'c', category: 'ems', units: [{ type: 'ems_als' }] }),
        // Not a unit-bearing category, so it moves the per-category numbers but
        // not the fire/EMS headline.
        facility({ id: 'd', category: 'hospital' }),
      ]),
    )
    expect(report.categories.fire).toEqual({ facilities: 2, with_units: 1 })
    expect(report.categories.ems).toEqual({ facilities: 1, with_units: 1 })
    expect(report.categories.hospital).toEqual({ facilities: 1, with_units: 0 })
    expect(report.units).toEqual({ applicable: 3, with_units: 2 })
    expect(report.facilities).toBe(4)
  })

  it('counts a tagged facility once however many specialties it carries', () => {
    const report = regionCoverage(
      region({}, [
        facility({ id: 'a', specialties: ['hazmat', 'technical_rescue'] }),
        facility({ id: 'b', specialties: [] }),
        facility({ id: 'c' }),
      ]),
    )
    expect(report.specialties).toEqual({ tagged: 1, total: 3 })
  })

  it('splits hospitals three ways: designated, stated as none, never stated', () => {
    const report = regionCoverage(
      region({}, [
        facility({ id: 'a', category: 'hospital', attributes: { trauma_level: 1 } }),
        facility({
          id: 'b',
          category: 'hospital',
          attributes: { trauma_designation: { system: 'nhs_mtn', label: 'Trauma Unit' } },
        }),
        // Looked at, and the answer was "no designation" — an answer, not a gap.
        facility({ id: 'c', category: 'hospital', attributes: { trauma_level: null } }),
        facility({ id: 'd', category: 'hospital', attributes: { beds: 120 } }),
        facility({ id: 'e', category: 'hospital' }),
      ]),
    )
    expect(report.trauma).toEqual({
      hospitals: 5,
      designated: 2,
      stated_none: 1,
      unstated: 2,
    })
  })

  it('reads declared coverage off the metadata, and reports its absence as absence', () => {
    const declared = regionCoverage(
      region({
        coverage: {
          searched: ['fire', 'tow'],
          gaps: [{ what: 'tow operators', categories: ['tow'], reason: 'no public addresses' }],
        },
      }),
    )
    expect(declared.coverage.declared).toBe(true)
    expect(declared.coverage.searched).toBe(2)
    expect(declared.coverage.gaps).toHaveLength(1)

    const undeclared = regionCoverage(region())
    expect(undeclared.coverage).toEqual({ declared: false, searched: 0, gaps: [] })
  })

  it('survives a region with no features at all', () => {
    const report = regionCoverage(region({}, []))
    expect(report.facilities).toBe(0)
    expect(report.units).toEqual({ applicable: 0, with_units: 0 })
    expect(report.confidence).toEqual({ high: 0, medium: 0, low: 0 })
  })
})

describe('totalCoverage', () => {
  it('sums facilities, units, confidence and gaps across regions', () => {
    const a = regionCoverage(
      region({ region_id: 'us-ga-a' }, [
        facility({ id: 'a', units: [{ type: 'engine' }], confidence: 'high' }),
      ]),
    )
    const b = regionCoverage(
      region(
        {
          region_id: 'us-ga-b',
          coverage: { gaps: [{ what: 'tow operators', reason: 'no public addresses' }] },
        },
        [facility({ id: 'b', category: 'ems' }), facility({ id: 'c', category: 'hospital' })],
      ),
    )
    const total = totalCoverage([a, b])
    expect(total.regions).toBe(2)
    expect(total.facilities).toBe(3)
    expect(total.units).toEqual({ applicable: 2, with_units: 1 })
    expect(total.confidence).toEqual({ high: 1, medium: 2, low: 0 })
    expect(total.categories.fire).toEqual({ facilities: 1, with_units: 1 })
    expect(total.coverage).toEqual({ declared: 1, gaps: 1 })
  })
})

describe('review age', () => {
  it('measures whole days against the given date', () => {
    expect(ageInDays('2026-08-01', '2026-08-18')).toBe(17)
    expect(ageInDays('2026-08-18', '2026-08-18')).toBe(0)
    expect(ageInDays(null, '2026-08-18')).toBeNull()
  })

  it('ranks oldest first, and a region that has never been reviewed first of all', () => {
    const reports = [
      regionCoverage(region({ region_id: 'b', last_reviewed: '2026-08-10' })),
      regionCoverage(region({ region_id: 'c', last_reviewed: undefined })),
      regionCoverage(region({ region_id: 'a', last_reviewed: '2026-01-01' })),
    ]
    expect(byReviewAge(reports, AS_OF).map((r) => r.region_id)).toEqual(['c', 'a', 'b'])
  })

  it('breaks a tie on region_id, so the order is stable between runs', () => {
    const reports = [
      regionCoverage(region({ region_id: 'z', last_reviewed: '2026-08-10' })),
      regionCoverage(region({ region_id: 'a', last_reviewed: '2026-08-10' })),
    ]
    expect(byReviewAge(reports, AS_OF).map((r) => r.region_id)).toEqual(['a', 'z'])
  })
})

const dirs = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

/** Write a regions directory and run the real script over it. */
function run(flags = [], regions) {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-atlas-report-'))
  dirs.push(dir)
  const files = regions ?? { 'us-ga-testville.geojson': region() }
  writeFileSync(
    join(dir, 'index.json'),
    JSON.stringify({
      schema_version: 2,
      regions: Object.entries(files).map(([file, data]) => ({
        region_id: data.metadata.region_id,
        name: data.metadata.name,
        country: data.metadata.country,
        file,
        status: 'published',
      })),
    }),
  )
  for (const [file, data] of Object.entries(files)) {
    writeFileSync(join(dir, file), JSON.stringify(data))
  }
  const { status, stdout, stderr } = spawnSync(
    'node',
    [SCRIPT, '--dir', dir, '--as-of', AS_OF, ...flags],
    { encoding: 'utf8' },
  )
  return { code: status, out: `${stdout}${stderr}` }
}

describe('report.mjs', () => {
  it('reports a region with no depth at all without failing', () => {
    // The whole point of the phase: a thin region is reported, not rejected.
    const thin = region({ region_id: 'us-ga-thin', name: 'Thin' }, [
      facility({ id: 'a', units: [], specialties: [], confidence: 'low' }),
    ])
    const { code, out } = run([], { 'us-ga-thin.geojson': thin })
    expect(code).toBe(0)
    expect(out).toContain('us-ga-thin')
    expect(out).toContain('0/1 (0%)')
    expect(out).toMatch(/no number here gates a merge/i)
  })

  it('says which regions have declared no coverage, and lists the gaps of those that have', () => {
    const declared = region(
      {
        region_id: 'us-ga-declared',
        name: 'Declared',
        coverage: {
          searched: ['tow'],
          gaps: [{ what: 'tow operators', reason: 'no public addresses', count: 4 }],
        },
      },
      [facility({ id: 'a' })],
    )
    const { out } = run([], {
      'us-ga-declared.geojson': declared,
      'us-ga-testville.geojson': region(),
    })
    expect(out).toContain('tow operators (4) — no public addresses')
    expect(out).toContain('No declared coverage (metadata.coverage): us-ga-testville')
  })

  it('--stale ranks by review age and names the next depth pass', () => {
    const { code, out } = run(['--stale'], {
      'us-ga-old.geojson': region({ region_id: 'us-ga-old', last_reviewed: '2026-01-05' }),
      'us-ga-new.geojson': region({ region_id: 'us-ga-new', last_reviewed: '2026-08-17' }),
    })
    expect(code).toBe(0)
    expect(out.indexOf('us-ga-old')).toBeLessThan(out.indexOf('us-ga-new'))
    expect(out).toContain('Next depth pass: us-ga-old')
    // The queue is a prompt for a person; nothing here schedules anything.
    expect(out).toMatch(/never on a schedule/i)
    expect(out).toContain('template=06-region-review.yml')
  })

  it('--json emits the ranked regions, the totals and the as-of date', () => {
    const { code, out } = run(['--json'], {
      'us-ga-old.geojson': region({ region_id: 'us-ga-old', last_reviewed: '2026-01-05' }),
      'us-ga-new.geojson': region({ region_id: 'us-ga-new', last_reviewed: '2026-08-17' }),
    })
    expect(code).toBe(0)
    const data = JSON.parse(out)
    expect(data.as_of).toBe(AS_OF)
    expect(data.regions.map((r) => r.region_id)).toEqual(['us-ga-old', 'us-ga-new'])
    expect(data.regions[0].age_days).toBe(225)
    expect(data.totals.facilities).toBe(2)
  })

  it('--region narrows to one region', () => {
    const files = {
      'us-ga-old.geojson': region({ region_id: 'us-ga-old' }),
      'us-ga-testville.geojson': region(),
    }
    const { out } = run(['--region', 'us-ga-old'], files)
    expect(out).toContain('us-ga-old')
    expect(out).not.toContain('us-ga-testville')
  })

  it('rejects an --as-of that is not an ISO date', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dispatch-atlas-report-'))
    dirs.push(dir)
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ schema_version: 2, regions: [] }))
    const { status, stderr } = spawnSync(
      'node',
      [SCRIPT, '--dir', dir, '--as-of', 'last tuesday'],
      { encoding: 'utf8' },
    )
    expect(status).toBe(1)
    expect(stderr).toContain('must be an ISO date')
  })
})
