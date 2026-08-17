import { describe, expect, it } from 'vitest'
import {
  buildRegionTree,
  countryLabel,
  filterRegionTree,
  flattenRegions,
  type RegionNode,
} from './regionTree'
import { regionEntry } from '../test/fixtures'

const savannah = regionEntry({
  region_id: 'us-ga-savannah',
  name: 'Savannah',
  country: 'US',
  admin: 'ga',
  admin_name: 'Georgia',
})
const charleston = regionEntry({
  region_id: 'us-sc-charleston',
  name: 'Charleston',
  country: 'US',
  admin: 'sc',
  admin_name: 'South Carolina',
})
const liverpool = regionEntry({
  region_id: 'gb-mersey-liverpool',
  name: 'Liverpool',
  country: 'GB',
  admin: 'mersey',
  admin_name: 'Merseyside',
})

/** Node ids/names as a nested `label > child, child` sketch, for readable assertions. */
const sketch = (nodes: RegionNode[]): string[] =>
  nodes.map((n) =>
    n.kind === 'region' ? n.entry.name : `${n.label} (${n.count}) [${sketch(n.children).join(', ')}]`,
  )

describe('countryLabel', () => {
  it('expands an ISO country code', () => {
    expect(countryLabel('US')).toBe('United States')
    expect(countryLabel('GB')).toBe('United Kingdom')
  })

  it('accepts a lowercase code', () => {
    expect(countryLabel('gb')).toBe('United Kingdom')
  })

  it('falls back to the code itself when it is not a region code', () => {
    expect(countryLabel('ZZZZ')).toBe('ZZZZ')
    expect(countryLabel('')).toBe('')
  })
})

describe('buildRegionTree', () => {
  it('groups regions under their country', () => {
    expect(sketch(buildRegionTree([savannah, charleston, liverpool]))).toEqual([
      'United Kingdom (1) [Liverpool]',
      'United States (2) [Georgia (1) [Savannah], South Carolina (1) [Charleston]]',
    ])
  })

  it('collapses a division level that does not branch', () => {
    // One division in GB, so Liverpool hangs straight off the country.
    expect(sketch(buildRegionTree([liverpool]))).toEqual(['United Kingdom (1) [Liverpool]'])
  })

  it('shows the division level as soon as a second division appears', () => {
    const manchester = regionEntry({
      region_id: 'gb-gm-manchester',
      name: 'Manchester',
      country: 'GB',
      admin: 'gm',
      admin_name: 'Greater Manchester',
    })
    expect(sketch(buildRegionTree([liverpool, manchester]))).toEqual([
      'United Kingdom (2) [Greater Manchester (1) [Manchester], Merseyside (1) [Liverpool]]',
    ])
  })

  it('hangs a region with no division straight off its country', () => {
    const monaco = regionEntry({ region_id: 'mc-monaco', name: 'Monaco', country: 'MC' })
    expect(sketch(buildRegionTree([monaco]))).toEqual(['Monaco (1) [Monaco]'])
  })

  it('mixes divisioned and division-less regions at the same level', () => {
    const noDivision = regionEntry({ region_id: 'gb-london', name: 'London', country: 'GB' })
    const manchester = regionEntry({
      region_id: 'gb-gm-manchester',
      name: 'Manchester',
      country: 'GB',
      admin: 'gm',
      admin_name: 'Greater Manchester',
    })
    expect(sketch(buildRegionTree([liverpool, manchester, noDivision]))).toEqual([
      'United Kingdom (3) [Greater Manchester (1) [Manchester], London, Merseyside (1) [Liverpool]]',
    ])
  })

  it('labels a division by its code when no entry names it', () => {
    const unnamed = regionEntry({ region_id: 'us-fl-tampa', name: 'Tampa', country: 'US', admin: 'fl' })
    const tree = buildRegionTree([savannah, unnamed])
    expect(sketch(tree)).toEqual(['United States (2) [FL (1) [Tampa], Georgia (1) [Savannah]]'])
  })

  it('sorts countries, divisions and regions by name', () => {
    const tree = buildRegionTree([charleston, liverpool, savannah])
    expect(tree.map((n) => (n.kind === 'group' ? n.label : n.entry.name))).toEqual([
      'United Kingdom',
      'United States',
    ])
  })

  it('normalizes the country code to upper case', () => {
    const lower = regionEntry({ region_id: 'gb-london', name: 'London', country: 'gb' })
    const [gb] = buildRegionTree([lower])
    expect(gb.kind === 'group' && gb.id).toBe('GB')
  })

  it('returns nothing for an empty registry', () => {
    expect(buildRegionTree([])).toEqual([])
  })

  it('records the full path on each leaf', () => {
    const leaf = flattenRegions(buildRegionTree([savannah, charleston])).find(
      (l) => l.entry.region_id === 'us-ga-savannah',
    )
    expect(leaf?.path).toEqual([
      { label: 'United States', code: 'US' },
      { label: 'Georgia', code: 'GA' },
    ])
  })
})

describe('filterRegionTree', () => {
  const tree = buildRegionTree([savannah, charleston, liverpool])

  it('returns the tree untouched for a blank query', () => {
    expect(filterRegionTree(tree, '')).toBe(tree)
    expect(filterRegionTree(tree, '   ')).toBe(tree)
  })

  it('matches on the region name', () => {
    expect(sketch(filterRegionTree(tree, 'savannah'))).toEqual([
      'United States (1) [Georgia (1) [Savannah]]',
    ])
  })

  it('matches on a group label the picker shows above the region', () => {
    expect(sketch(filterRegionTree(tree, 'georgia'))).toEqual([
      'United States (1) [Georgia (1) [Savannah]]',
    ])
  })

  it('matches on the region id and the country code', () => {
    expect(flattenRegions(filterRegionTree(tree, 'us ga')).map((l) => l.entry.name)).toEqual([
      'Savannah',
    ])
    expect(flattenRegions(filterRegionTree(tree, 'gb-mersey')).map((l) => l.entry.name)).toEqual([
      'Liverpool',
    ])
  })

  it('requires every token to match', () => {
    expect(filterRegionTree(tree, 'savannah liverpool')).toEqual([])
  })

  it('is case- and diacritic-insensitive', () => {
    const lyon = regionEntry({ region_id: 'fr-ara-lyon', name: 'Lyon (Rhône)', country: 'FR' })
    const withLyon = buildRegionTree([lyon])
    expect(flattenRegions(filterRegionTree(withLyon, 'RHONE'))).toHaveLength(1)
  })

  it('recounts the groups it keeps', () => {
    const [us] = filterRegionTree(tree, 'united states')
    expect(us.kind === 'group' && us.count).toBe(2)
    const [narrowed] = filterRegionTree(tree, 'charleston')
    expect(narrowed.kind === 'group' && narrowed.count).toBe(1)
  })

  it('drops groups with nothing left below them', () => {
    expect(filterRegionTree(tree, 'zzzzz')).toEqual([])
  })
})

describe('flattenRegions', () => {
  it('lists every region in display order', () => {
    const tree = buildRegionTree([savannah, charleston, liverpool])
    expect(flattenRegions(tree).map((l) => l.entry.name)).toEqual([
      'Liverpool',
      'Savannah',
      'Charleston',
    ])
  })

  it('returns nothing for an empty tree', () => {
    expect(flattenRegions([])).toEqual([])
  })
})
