// Deep-link state ⇄ URL. The region, sub-region, facet filters, search query
// and selected facility all live in the query string so a view is shareable
// ("here's the SWAT coverage in this city"). Writes use replaceState — sharing
// wants the current view in the address bar, not an entry per keystroke.
import { EMPTY_FILTERS, FACET_KEYS, type FacetKey, type Filters } from './filters'

export interface UrlState {
  regionId: string | null
  subregionId: string | null
  filters: Filters
  selectedId: string | null
  /** Whether the About/provenance dialog is open — shareable as an answer to
   *  "where is this data from?". */
  about: boolean
}

/** URL param name for each multi-valued facet (repeated key per value). */
const FACET_PARAM: Record<FacetKey, string> = {
  categories: 'cat',
  agencies: 'agency',
  specialties: 'spec',
  staffing: 'staff',
  statuses: 'status',
}

export function parseUrl(search: string = window.location.search): UrlState {
  const p = new URLSearchParams(search)
  const filters: Filters = { ...EMPTY_FILTERS, query: p.get('q') ?? '' }
  for (const key of FACET_KEYS) filters[key] = p.getAll(FACET_PARAM[key])
  return {
    regionId: p.get('region'),
    subregionId: p.get('sub'),
    filters,
    selectedId: p.get('sel'),
    about: p.get('about') === '1',
  }
}

export function serializeState(state: UrlState): string {
  const p = new URLSearchParams()
  if (state.regionId) p.set('region', state.regionId)
  if (state.subregionId && state.subregionId !== 'all') p.set('sub', state.subregionId)
  for (const key of FACET_KEYS) {
    for (const value of state.filters[key]) p.append(FACET_PARAM[key], value)
  }
  const q = state.filters.query.trim()
  if (q) p.set('q', q)
  if (state.selectedId) p.set('sel', state.selectedId)
  if (state.about) p.set('about', '1')
  return p.toString()
}

/** Reflect the current state into the address bar without a history entry. */
export function writeUrl(state: UrlState): void {
  const qs = serializeState(state)
  const { pathname, hash } = window.location
  window.history.replaceState(null, '', `${pathname}${qs ? `?${qs}` : ''}${hash}`)
}
