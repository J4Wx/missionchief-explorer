// Coverage and review-age report over the published regions (docs/07 Phase 8).
//
// This is the "what should I look at next" command. It counts what each region
// carries — unit coverage by category, specialty tagging, confidence mix,
// trauma designations, declared gaps — and ranks regions by how long it has
// been since anyone worked one end to end.
//
// It is **advisory**. There is no threshold in here, nothing exits non-zero for
// a thin region, and nothing suggests deleting a record: a facility with a
// building, an address and a source is worth keeping whether or not its roster
// was ever found. `npm run validate` remains the only hard gate. What the
// report produces is a queue for a *human* to pull from — depth passes are
// prompted, never scheduled (docs/06 § Depth passes).
//
// Run: npm run report -- --help
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { die, parseArgs } from './lib/cli.mjs'
import { REGIONS_DIR, indexPath, readJson } from './lib/regions.mjs'
import { byReviewAge, pct, regionCoverage, totalCoverage } from './lib/coverage.mjs'

// Same default as src/lib/links.ts, overridable the same way a fork would.
const REPO_URL = process.env.REPO_URL ?? 'https://github.com/J4Wx/missionchief-explorer'
const REVIEW_TEMPLATE = '06-region-review.yml'

const USAGE = `
Coverage and review age across the published regions.

Usage:
  npm run report
  npm run report -- --stale
  npm run report -- --json
  npm run report -- --region us-ga-savannah

Options:
  --stale            rank regions by review age, oldest first, and name the one
                     a depth pass should take next
  --json             emit the same numbers as JSON (what CI reads)
  --region <id>      report on one region
  --as-of <date>     measure ages against this ISO date instead of today
  --dir <path>       regions directory (default: ${REGIONS_DIR})
  --help             show this

Nothing here fails a build or gates a merge: the numbers are a prompt for a
human to request a depth pass (docs/06 § Depth passes), not a quality bar.
`

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(USAGE.trim())
  process.exit(0)
}

const dir = typeof args.dir === 'string' ? args.dir : REGIONS_DIR
const asOf = typeof args['as-of'] === 'string' ? args['as-of'] : new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) die(`--as-of "${asOf}" must be an ISO date (YYYY-MM-DD)`)

let index
try {
  index = readJson(indexPath(dir))
} catch (err) {
  die(`can't read ${indexPath(dir)}: ${err.message}`)
}
const entries = index.regions ?? []

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.geojson'))
  .sort()

const reports = []
const skipped = []
for (const file of files) {
  let region
  try {
    region = readJson(join(dir, file))
  } catch (err) {
    skipped.push({ file, message: err.message })
    continue
  }
  const report = regionCoverage(region)
  report.file = file
  if (typeof args.region === 'string' && report.region_id !== args.region) continue
  reports.push(report)
}

if (typeof args.region === 'string' && reports.length === 0) {
  die(`no region file for "${args.region}" in ${dir}`)
}

const ranked = byReviewAge(reports, asOf)
const totals = totalCoverage(reports)
const queued = entries.filter((e) => e.status !== 'published')

/** "12" / "12 (40%)" — a count, with its share when there is one. */
const share = (part, whole) => {
  const percent = pct(part, whole)
  return percent === null ? `${part}/${whole}` : `${part}/${whole} (${percent}%)`
}

const reviewIssueUrl = (regionId, name) =>
  `${REPO_URL}/issues/new?template=${REVIEW_TEMPLATE}` +
  `&title=${encodeURIComponent(`[Review] ${name ?? regionId}`)}` +
  `&region=${encodeURIComponent(regionId ?? '')}`

const ageLabel = (report) => {
  if (!report.last_reviewed) return 'never reviewed'
  const days = report.age_days
  if (days === null) return report.last_reviewed
  if (days === 0) return 'today'
  return `${days} day${days === 1 ? '' : 's'} ago`
}

if (args.json === true) {
  console.log(
    JSON.stringify(
      {
        as_of: asOf,
        regions: ranked,
        totals,
        queued: queued.map((e) => ({ region_id: e.region_id, name: e.name, status: e.status })),
        unreadable: skipped,
      },
      null,
      2,
    ),
  )
  process.exit(0)
}

if (args.stale === true) {
  console.log(`Review age — oldest first (as of ${asOf})\n`)
  const idWidth = Math.max(...ranked.map((r) => (r.region_id ?? '').length), 9)
  for (const report of ranked) {
    const bits = [
      `${report.facilities} facilities`,
      report.units.applicable > 0
        ? `${pct(report.units.with_units, report.units.applicable)}% fire/EMS units`
        : null,
      report.coverage.declared
        ? `${report.coverage.gaps.length} declared gap${report.coverage.gaps.length === 1 ? '' : 's'}`
        : 'no declared coverage',
    ].filter(Boolean)
    console.log(
      `  ${(report.region_id ?? '?').padEnd(idWidth)}  ${(report.last_reviewed ?? '—').padEnd(10)}` +
        `  ${ageLabel(report).padEnd(14)}  ${bits.join(' · ')}`,
    )
  }
  const next = ranked[0]
  if (next) {
    console.log(`\nNext depth pass: ${next.region_id} — ${next.name ?? ''}`.trimEnd())
    console.log(`  Contract: docs/06 § Depth passes over a published region`)
    console.log(`  Request one: ${reviewIssueUrl(next.region_id, next.name)}`)
  }
  console.log(
    '\nAdvisory only — a depth pass happens because someone asks for it, never on a schedule.',
  )
  process.exit(0)
}

// ── the table ─────────────────────────────────────────────────────────────────
const rows = ranked.map((report) => [
  report.region_id ?? report.file,
  String(report.facilities),
  report.units.applicable > 0 ? share(report.units.with_units, report.units.applicable) : '—',
  share(report.specialties.tagged, report.specialties.total),
  report.trauma.hospitals > 0 ? share(report.trauma.designated, report.trauma.hospitals) : '—',
  `${report.confidence.high}/${report.confidence.medium}/${report.confidence.low}`,
  report.coverage.declared ? String(report.coverage.gaps.length) : '—',
  `${report.last_reviewed ?? 'never'}${report.age_days === null ? '' : ` (${report.age_days}d)`}`,
])

const totalRow = [
  `${reports.length} regions`,
  String(totals.facilities),
  totals.units.applicable > 0 ? share(totals.units.with_units, totals.units.applicable) : '—',
  share(totals.specialties.tagged, totals.specialties.total),
  totals.trauma.hospitals > 0 ? share(totals.trauma.designated, totals.trauma.hospitals) : '—',
  `${totals.confidence.high}/${totals.confidence.medium}/${totals.confidence.low}`,
  String(totals.coverage.gaps),
  '',
]

const header = [
  'Region',
  'Facilities',
  'Fire/EMS units',
  'Specialties',
  'Trauma',
  'Conf H/M/L',
  'Gaps',
  'Reviewed',
]
const widths = header.map((h, i) =>
  Math.max(h.length, ...[...rows, totalRow].map((row) => row[i].length)),
)
const line = (row) => row.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd()

console.log(`Coverage — ${reports.length} region(s), ${totals.facilities} facilities (as of ${asOf})\n`)
console.log(line(header))
console.log(widths.map((w) => '─'.repeat(w)).join('  '))
for (const row of rows) console.log(line(row))
console.log(widths.map((w) => '─'.repeat(w)).join('  '))
console.log(line(totalRow))

const undeclared = ranked.filter((r) => !r.coverage.declared)
if (undeclared.length > 0) {
  console.log(
    `\nNo declared coverage (metadata.coverage): ${undeclared.map((r) => r.region_id).join(', ')}` +
      '\n  Nothing is wrong with these — it just means nobody has written down what was' +
      '\n  searched, so "not covered here" and "nothing there" still look the same.',
  )
}

const withGaps = ranked.filter((r) => r.coverage.gaps.length > 0)
if (withGaps.length > 0) {
  console.log('\nDeclared gaps')
  for (const report of withGaps) {
    console.log(`  ${report.region_id}`)
    for (const gap of report.coverage.gaps) {
      const count = gap.count === undefined ? '' : ` (${gap.count})`
      console.log(`    · ${gap.what}${count} — ${gap.reason}`)
    }
  }
}

if (queued.length > 0) {
  console.log(
    `\nQueued in the registry: ${queued.map((e) => `${e.region_id} (${e.status})`).join(', ')}`,
  )
}

for (const { file, message } of skipped) {
  console.log(`\n! ${file} could not be read: ${message}`)
}

const oldest = ranked[0]
if (oldest) {
  console.log(
    `\nOldest review: ${oldest.region_id} — ${ageLabel(oldest)}.` +
      ` Run \`npm run report -- --stale\` for the queue.`,
  )
}
console.log('Advisory: no number here gates a merge, and no record is dropped for lacking one.')
