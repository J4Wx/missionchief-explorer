import { describe, expect, it } from 'vitest'
import { attributeEntries, formatCoords, formatValue, humanize } from './format'

describe('humanize', () => {
  it('title-cases snake_case and kebab-case keys', () => {
    expect(humanize('trauma_level')).toBe('Trauma Level')
    expect(humanize('bomb-squad')).toBe('Bomb Squad')
    expect(humanize('security_level-1')).toBe('Security Level 1')
  })

  it('collapses runs of separators and trims the edges', () => {
    expect(humanize('__hazmat__team__')).toBe('Hazmat Team')
  })

  it('leaves an already-readable value alone', () => {
    expect(humanize('Ladder')).toBe('Ladder')
  })

  it('handles the empty string', () => {
    expect(humanize('')).toBe('')
  })
})

describe('formatValue', () => {
  it('renders an em dash for null and undefined', () => {
    expect(formatValue(null)).toBe('—')
    expect(formatValue(undefined)).toBe('—')
  })

  it('renders booleans as Yes/No', () => {
    expect(formatValue(true)).toBe('Yes')
    expect(formatValue(false)).toBe('No')
  })

  it('renders numbers and strings as-is', () => {
    expect(formatValue(42)).toBe('42')
    expect(formatValue(0)).toBe('0')
    expect(formatValue('Level I')).toBe('Level I')
  })

  it('joins arrays with commas', () => {
    expect(formatValue(['hazmat', 'swat'])).toBe('hazmat, swat')
    expect(formatValue([])).toBe('')
  })

  it('spells out an object as humanized key/value pairs', () => {
    expect(formatValue({ trauma_level: 1, helipad: true })).toBe('Trauma Level: 1, Helipad: Yes')
  })

  it('recurses through nesting', () => {
    expect(formatValue({ beds: { icu: 24, total: 612 } })).toBe('Beds: Icu: 24, Total: 612')
    expect(formatValue([{ a: 1 }, { b: 2 }])).toBe('A: 1, B: 2')
  })
})

describe('attributeEntries', () => {
  it('returns the populated entries', () => {
    expect(attributeEntries({ beds: 612, trauma_designation: 'Level I' })).toEqual([
      ['beds', 612],
      ['trauma_designation', 'Level I'],
    ])
  })

  it('skips null, undefined and empty-string values', () => {
    expect(attributeEntries({ a: null, b: undefined, c: '', d: 0, e: false })).toEqual([
      ['d', 0],
      ['e', false],
    ])
  })

  it('returns nothing for a non-object', () => {
    expect(attributeEntries(undefined)).toEqual([])
    expect(attributeEntries(null)).toEqual([])
    expect(attributeEntries('beds: 612')).toEqual([])
    expect(attributeEntries(['beds'])).toEqual([])
  })

  it('returns nothing for an empty object', () => {
    expect(attributeEntries({})).toEqual([])
  })
})

describe('formatCoords', () => {
  it('swaps [lng, lat] into the "lat, lng" form map search boxes take', () => {
    expect(formatCoords([-81.09123, 32.08094])).toBe('32.08094, -81.09123')
  })

  it('pads to five decimals', () => {
    expect(formatCoords([-81, 32])).toBe('32.00000, -81.00000')
  })

  it('rounds to five decimals', () => {
    expect(formatCoords([-81.0912349, 32.0809451])).toBe('32.08095, -81.09123')
  })
})
