// The coverage numbers `npm run report` prints and CI posts (docs/07 Phase 8).
//
// Pure by design: every function here takes parsed region files and returns
// plain data, reading neither the clock nor the filesystem. That is what lets
// the report be asserted on directly, and what keeps "as of" a parameter rather
// than a hidden dependency — a report is only comparable to another one if you
// know the date it was measured against.
//
// Nothing in here judges. It counts what is there and what is declared missing;
// deciding that a number is too low is a human's call, and no threshold in this
// file (there are none) gates a merge.

/**
 * Categories whose headline promise is "what runs from this house" (docs/06 §
 * Quality bar per category). Unit coverage is reported for every category that
 * appears in a region, but these are the two the summary line is about.
 */
export const UNIT_CATEGORIES = ['fire', 'ems']

const CONFIDENCE_LEVELS = ['high', 'medium', 'low']

/** Percentage as a whole number, or null when there's nothing to divide by. */
export function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : null
}

/** Whole days between two ISO dates, or null if either is missing. */
export function ageInDays(date, asOf) {
  if (!date || !asOf) return null
  const from = Date.parse(`${date}T00:00:00Z`)
  const to = Date.parse(`${asOf}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86_400_000)
}

/**
 * One region's coverage. `categories` is keyed by category so the caller can
 * show unit coverage per service rather than one blended number — a region of
 * lifeboat stations and one of fire houses are not comparable in aggregate.
 */
export function regionCoverage(region) {
  const meta = region?.metadata ?? {}
  const features = region?.features ?? []

  const categories = {}
  const confidence = Object.fromEntries(CONFIDENCE_LEVELS.map((c) => [c, 0]))
  // Hospitals split three ways on purpose: a stated "no trauma designation" is
  // an answer, and an absent key is nobody having looked. Collapsing them would
  // hide exactly the difference this phase exists to surface.
  const trauma = { hospitals: 0, designated: 0, stated_none: 0, unstated: 0 }
  let tagged = 0

  for (const feature of features) {
    const p = feature?.properties ?? {}
    const cat = (categories[p.category] ??= { facilities: 0, with_units: 0 })
    cat.facilities++
    if ((p.units ?? []).length > 0) cat.with_units++
    if ((p.specialties ?? []).length > 0) tagged++
    if (p.confidence in confidence) confidence[p.confidence]++

    if (p.category === 'hospital') {
      trauma.hospitals++
      const attrs = p.attributes ?? {}
      const stated = 'trauma_level' in attrs || 'trauma_designation' in attrs
      const value = attrs.trauma_level ?? attrs.trauma_designation ?? null
      if (value != null) trauma.designated++
      else if (stated) trauma.stated_none++
      else trauma.unstated++
    }
  }

  const units = { applicable: 0, with_units: 0 }
  for (const category of UNIT_CATEGORIES) {
    const cat = categories[category]
    if (!cat) continue
    units.applicable += cat.facilities
    units.with_units += cat.with_units
  }

  const declared = meta.coverage ?? null

  return {
    region_id: meta.region_id ?? null,
    name: meta.name ?? null,
    country: meta.country ?? null,
    facilities: features.length,
    units,
    categories,
    specialties: { tagged, total: features.length },
    confidence,
    trauma,
    coverage: {
      declared: declared !== null,
      searched: declared?.searched?.length ?? 0,
      gaps: declared?.gaps ?? [],
    },
    last_reviewed: meta.last_reviewed ?? null,
  }
}

/** The same shape, summed — the catalog as one row. */
export function totalCoverage(reports) {
  const total = {
    regions: reports.length,
    facilities: 0,
    units: { applicable: 0, with_units: 0 },
    categories: {},
    specialties: { tagged: 0, total: 0 },
    confidence: Object.fromEntries(CONFIDENCE_LEVELS.map((c) => [c, 0])),
    trauma: { hospitals: 0, designated: 0, stated_none: 0, unstated: 0 },
    coverage: { declared: 0, gaps: 0 },
  }

  for (const r of reports) {
    total.facilities += r.facilities
    total.units.applicable += r.units.applicable
    total.units.with_units += r.units.with_units
    total.specialties.tagged += r.specialties.tagged
    total.specialties.total += r.specialties.total
    for (const level of CONFIDENCE_LEVELS) total.confidence[level] += r.confidence[level]
    for (const key of Object.keys(total.trauma)) total.trauma[key] += r.trauma[key]
    for (const [category, cat] of Object.entries(r.categories)) {
      const into = (total.categories[category] ??= { facilities: 0, with_units: 0 })
      into.facilities += cat.facilities
      into.with_units += cat.with_units
    }
    if (r.coverage.declared) total.coverage.declared++
    total.coverage.gaps += r.coverage.gaps.length
  }

  return total
}

/**
 * Regions ranked by how long they've gone without a whole-region pass, oldest
 * first — the order `--stale` prints and the app offers as "could use a look".
 * A region that has never recorded a review sorts first: unknown age is the
 * strongest case for looking, not an excuse to skip it.
 */
export function byReviewAge(reports, asOf) {
  return [...reports]
    .map((report) => ({ ...report, age_days: ageInDays(report.last_reviewed, asOf) }))
    .sort((a, b) => {
      if (a.last_reviewed === b.last_reviewed) {
        return (a.region_id ?? '').localeCompare(b.region_id ?? '')
      }
      if (!a.last_reviewed) return -1
      if (!b.last_reviewed) return 1
      return a.last_reviewed.localeCompare(b.last_reviewed)
    })
}
