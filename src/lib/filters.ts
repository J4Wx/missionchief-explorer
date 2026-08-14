// The facet-filter model: what a player has narrowed the region to, plus the
// pure functions that apply it and derive the available options. Kept out of
// App (and free of React) so the filtering rules stay testable and the URL
// layer (src/lib/url.ts) can round-trip the same shape.
import type { Facility, FacilityFeature } from '../types/app'
import { CATEGORY_ORDER, categoryLabel } from './categories'
import { humanize } from './format'

/** The set-valued facet dimensions (everything in Filters except `query`). */
export type FacetKey = 'categories' | 'agencies' | 'specialties' | 'staffing' | 'statuses'

export const FACET_KEYS: FacetKey[] = [
  'categories',
  'agencies',
  'specialties',
  'staffing',
  'statuses',
]

/**
 * Active narrowing. Each facet is a set of selected values where **empty means
 * "no constraint"** (show all), so the cleared state has an empty URL and every
 * dimension round-trips uniformly. `query` is the free-text search (applied
 * separately via Fuse in src/lib/search.ts).
 */
export interface Filters {
  categories: string[]
  agencies: string[]
  specialties: string[]
  staffing: string[]
  statuses: string[]
  query: string
}

export const EMPTY_FILTERS: Filters = {
  categories: [],
  agencies: [],
  specialties: [],
  staffing: [],
  statuses: [],
  query: '',
}

/** Missing `staffing_model` is treated as the schema's explicit `unknown`. */
function staffingOf(p: Facility): string {
  return p.staffing_model ?? 'unknown'
}

/**
 * Statuses hidden unless the player asks for them. Closed and planned
 * facilities are noise for planning, so an empty status filter means "active
 * and unknown only" rather than "everything" (docs/05). Selecting any status
 * explicitly — including `closed`/`planned` — overrides this default.
 */
export const DEFAULT_HIDDEN_STATUSES = new Set(['closed', 'planned'])

function statusVisible(p: Facility, f: Filters): boolean {
  return f.statuses.length
    ? f.statuses.includes(p.status)
    : !DEFAULT_HIDDEN_STATUSES.has(p.status)
}

/**
 * Does a facility pass the facet filters, ignoring the `except` dimension?
 * Dimensions are AND-ed; within a dimension the selected values are OR-ed
 * (specialties match if the facility has *any* selected capability). `query` is
 * not a facet and is never applied here. Skipping one dimension is what lets a
 * facet's own options stay visible while it counts against the others.
 */
export function matchesFacetsExcept(p: Facility, f: Filters, except: FacetKey | null): boolean {
  if (except !== 'categories' && f.categories.length && !f.categories.includes(p.category)) {
    return false
  }
  if (except !== 'agencies' && f.agencies.length && !f.agencies.includes(p.agency.name)) {
    return false
  }
  if (except !== 'staffing' && f.staffing.length && !f.staffing.includes(staffingOf(p))) {
    return false
  }
  if (except !== 'statuses' && !statusVisible(p, f)) return false
  if (except !== 'specialties' && f.specialties.length) {
    const specs = p.specialties ?? []
    if (!f.specialties.some((s) => specs.includes(s))) return false
  }
  return true
}

/** Does a facility pass all facet filters? (`query` is applied separately.) */
export function matchesFacets(p: Facility, f: Filters): boolean {
  return matchesFacetsExcept(p, f, null)
}

/** Total number of active constraints — drives the "Filters (n)" badge. */
export function activeFilterCount(f: Filters): number {
  return (
    f.categories.length +
    f.agencies.length +
    f.specialties.length +
    f.staffing.length +
    f.statuses.length +
    (f.query.trim() ? 1 : 0)
  )
}

/** Add or remove a value from a facet dimension, returning a new Filters. */
export function toggleFacet(f: Filters, key: FacetKey, value: string): Filters {
  const current = f[key]
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value]
  return { ...f, [key]: next }
}

export interface FacetOption {
  value: string
  label: string
  /** How many facilities in the source set carry this value. */
  count: number
}

/** Available options + counts for each dimension, ready to render. */
export type FacetModel = Record<FacetKey, FacetOption[]>

// Enum dimensions get a fixed, meaningful order; free-text ones sort alpha.
const STAFFING_ORDER = ['career', 'volunteer', 'combination', 'unknown']
const STATUS_ORDER = ['active', 'planned', 'closed', 'unknown']

function tally(): Map<string, number> {
  return new Map<string, number>()
}

function bump(m: Map<string, number>, key: string): void {
  m.set(key, (m.get(key) ?? 0) + 1)
}

/**
 * Options in a caller-supplied order, then any leftovers alphabetically. A value
 * absent from `counts` is dropped (nothing left to narrow to given the other
 * filters) — *unless* it is currently selected, which is kept at count 0 so it
 * stays removable from its own group.
 */
function options(
  counts: Map<string, number>,
  order: string[],
  selected: string[],
  label: (value: string) => string,
): FacetOption[] {
  for (const value of selected) if (!counts.has(value)) counts.set(value, 0)

  const seen = new Set<string>()
  const ordered: string[] = []
  for (const value of order) {
    if (counts.has(value)) {
      ordered.push(value)
      seen.add(value)
    }
  }
  const rest = [...counts.keys()].filter((v) => !seen.has(v)).sort((a, b) => a.localeCompare(b))
  return [...ordered, ...rest].map((value) => ({
    value,
    label: label(value),
    count: counts.get(value) ?? 0,
  }))
}

/**
 * Derive the facet options and counts from a feature set, cross-filtered by the
 * current selection: each dimension is counted over the features that pass all
 * the *other* dimensions, so an option that the rest of the selection has ruled
 * out disappears rather than sitting there showing "0". A facet's own selected
 * values never hide themselves (see `options`).
 */
export function computeFacets(features: FacilityFeature[], filters: Filters): FacetModel {
  const cat = tally()
  const agency = tally()
  const spec = tally()
  const staff = tally()
  const status = tally()

  for (const feature of features) {
    const p = feature.properties
    if (matchesFacetsExcept(p, filters, 'categories')) bump(cat, p.category)
    if (matchesFacetsExcept(p, filters, 'agencies')) bump(agency, p.agency.name)
    if (matchesFacetsExcept(p, filters, 'staffing')) bump(staff, staffingOf(p))
    if (matchesFacetsExcept(p, filters, 'statuses')) bump(status, p.status)
    if (matchesFacetsExcept(p, filters, 'specialties')) {
      for (const s of p.specialties ?? []) bump(spec, s)
    }
  }

  return {
    categories: options(cat, CATEGORY_ORDER, filters.categories, (v) =>
      categoryLabel(v as Facility['category']),
    ),
    agencies: options(agency, [], filters.agencies, (v) => v),
    specialties: options(spec, [], filters.specialties, humanize),
    staffing: options(staff, STAFFING_ORDER, filters.staffing, humanize),
    statuses: options(status, STATUS_ORDER, filters.statuses, humanize),
  }
}
