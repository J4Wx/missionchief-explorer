import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  computeFacets,
  EMPTY_FILTERS,
  matchesFacets,
  matchesFacetsExcept,
  toggleFacet,
  type Filters,
} from './filters'
import { facility, feature } from '../test/fixtures'

const filters = (over: Partial<Filters> = {}): Filters => ({ ...EMPTY_FILTERS, ...over })

describe('matchesFacets', () => {
  it('passes everything when nothing is selected', () => {
    expect(matchesFacets(facility(), EMPTY_FILTERS)).toBe(true)
  })

  it('ORs the values within one dimension', () => {
    const f = filters({ categories: ['fire', 'ems'] })
    expect(matchesFacets(facility({ category: 'fire' }), f)).toBe(true)
    expect(matchesFacets(facility({ category: 'ems' }), f)).toBe(true)
    expect(matchesFacets(facility({ category: 'hospital' }), f)).toBe(false)
  })

  it('ANDs across dimensions', () => {
    const f = filters({ categories: ['fire'], staffing: ['volunteer'] })
    expect(matchesFacets(facility({ category: 'fire', staffing_model: 'volunteer' }), f)).toBe(true)
    expect(matchesFacets(facility({ category: 'fire', staffing_model: 'career' }), f)).toBe(false)
    expect(matchesFacets(facility({ category: 'ems', staffing_model: 'volunteer' }), f)).toBe(false)
  })

  it('matches a specialty selection if the facility has *any* of them', () => {
    const f = filters({ specialties: ['hazmat', 'swat'] })
    expect(matchesFacets(facility({ specialties: ['aerial', 'swat'] }), f)).toBe(true)
    expect(matchesFacets(facility({ specialties: ['aerial'] }), f)).toBe(false)
    expect(matchesFacets(facility({ specialties: undefined }), f)).toBe(false)
  })

  it('treats a missing staffing_model as `unknown`', () => {
    const f = filters({ staffing: ['unknown'] })
    expect(matchesFacets(facility({ staffing_model: undefined }), f)).toBe(true)
    expect(matchesFacets(facility({ staffing_model: 'unknown' }), f)).toBe(true)
    expect(matchesFacets(facility({ staffing_model: 'career' }), f)).toBe(false)
  })

  it('never applies `query` as a facet', () => {
    expect(matchesFacets(facility({ name: 'Station 1' }), filters({ query: 'nonsense' }))).toBe(true)
  })

  describe('status default', () => {
    it('hides closed and planned when no status is selected', () => {
      expect(matchesFacets(facility({ status: 'active' }), EMPTY_FILTERS)).toBe(true)
      expect(matchesFacets(facility({ status: 'unknown' }), EMPTY_FILTERS)).toBe(true)
      expect(matchesFacets(facility({ status: 'closed' }), EMPTY_FILTERS)).toBe(false)
      expect(matchesFacets(facility({ status: 'planned' }), EMPTY_FILTERS)).toBe(false)
    })

    it('is overridden by selecting a status explicitly', () => {
      const f = filters({ statuses: ['closed'] })
      expect(matchesFacets(facility({ status: 'closed' }), f)).toBe(true)
      expect(matchesFacets(facility({ status: 'active' }), f)).toBe(false)
    })
  })
})

describe('matchesFacetsExcept', () => {
  it('ignores the named dimension but still applies the others', () => {
    const p = facility({ category: 'hospital', staffing_model: 'career' })
    const f = filters({ categories: ['fire'], staffing: ['career'] })
    expect(matchesFacetsExcept(p, f, 'categories')).toBe(true)
    expect(matchesFacetsExcept(p, f, 'staffing')).toBe(false)
  })

  it('lifts the hidden-status default when statuses is the excepted dimension', () => {
    expect(matchesFacetsExcept(facility({ status: 'closed' }), EMPTY_FILTERS, 'statuses')).toBe(true)
  })
})

describe('activeFilterCount', () => {
  it('sums every selected value across dimensions', () => {
    expect(activeFilterCount(filters({ categories: ['fire', 'ems'], statuses: ['closed'] }))).toBe(3)
  })

  it('counts a query as one, and ignores whitespace-only', () => {
    expect(activeFilterCount(filters({ query: 'engine' }))).toBe(1)
    expect(activeFilterCount(filters({ query: '   ' }))).toBe(0)
  })

  it('is zero for the cleared state', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
  })
})

describe('toggleFacet', () => {
  it('adds a missing value and removes a present one', () => {
    const added = toggleFacet(EMPTY_FILTERS, 'categories', 'fire')
    expect(added.categories).toEqual(['fire'])
    expect(toggleFacet(added, 'categories', 'fire').categories).toEqual([])
  })

  it('leaves the input untouched', () => {
    const before = filters({ categories: ['fire'] })
    toggleFacet(before, 'categories', 'ems')
    expect(before.categories).toEqual(['fire'])
  })

  it('touches only the named dimension', () => {
    const next = toggleFacet(filters({ agencies: ['A'] }), 'categories', 'fire')
    expect(next.agencies).toEqual(['A'])
  })
})

describe('computeFacets', () => {
  const features = [
    feature({ category: 'fire', agency: { name: 'Savannah Fire' }, specialties: ['hazmat'] }),
    feature({ category: 'fire', agency: { name: 'Chatham Fire' }, staffing_model: 'volunteer' }),
    feature({ category: 'hospital', agency: { name: 'Memorial Health' }, specialties: ['trauma_major'] }),
    feature({ category: 'ems', agency: { name: 'Chatham EMS' }, status: 'closed' }),
  ]

  it('counts each value over the features that pass the other dimensions', () => {
    const facets = computeFacets(features, EMPTY_FILTERS)
    // The closed EMS record is excluded by the default status rule.
    expect(facets.categories).toEqual([
      { value: 'fire', label: 'Fire', count: 2 },
      { value: 'hospital', label: 'Hospital', count: 1 },
    ])
  })

  it('still offers closed/planned in the status dimension itself', () => {
    const statuses = computeFacets(features, EMPTY_FILTERS).statuses
    expect(statuses.map((o) => o.value)).toEqual(['active', 'closed'])
  })

  it('drops options the rest of the selection has ruled out', () => {
    const facets = computeFacets(features, filters({ categories: ['hospital'] }))
    expect(facets.agencies.map((o) => o.value)).toEqual(['Memorial Health'])
    expect(facets.specialties.map((o) => o.value)).toEqual(['trauma_major'])
  })

  it('cross-filters: a dimension is counted ignoring its own selection', () => {
    const facets = computeFacets(features, filters({ categories: ['hospital'] }))
    // Categories keep all their options so the selection stays changeable...
    expect(facets.categories.map((o) => o.value)).toEqual(['fire', 'hospital'])
    // ...while every other dimension narrows to the hospital.
    expect(facets.staffing.map((o) => o.value)).toEqual(['unknown'])
  })

  it('keeps a selected value at count 0 rather than hiding it', () => {
    const facets = computeFacets(features, filters({ categories: ['fire'], specialties: ['swat'] }))
    expect(facets.specialties).toContainEqual({ value: 'swat', label: 'Swat', count: 0 })
  })

  it('orders enum dimensions by their fixed order and the rest alphabetically', () => {
    const mixed = [
      feature({ category: 'hospital', agency: { name: 'Zeta' }, staffing_model: 'volunteer' }),
      feature({ category: 'fire', agency: { name: 'Alpha' }, staffing_model: 'career' }),
    ]
    const facets = computeFacets(mixed, EMPTY_FILTERS)
    expect(facets.categories.map((o) => o.value)).toEqual(['fire', 'hospital'])
    expect(facets.staffing.map((o) => o.value)).toEqual(['career', 'volunteer'])
    expect(facets.agencies.map((o) => o.value)).toEqual(['Alpha', 'Zeta'])
  })

  it('labels values for display', () => {
    const facets = computeFacets(
      [feature({ category: 'police_local', specialties: ['bomb_squad'] })],
      EMPTY_FILTERS,
    )
    expect(facets.categories[0].label).toBe('Police')
    expect(facets.specialties[0].label).toBe('Bomb Squad')
  })

  it('returns empty dimensions for an empty feature set', () => {
    const facets = computeFacets([], EMPTY_FILTERS)
    expect(Object.values(facets).every((options) => options.length === 0)).toBe(true)
  })
})
