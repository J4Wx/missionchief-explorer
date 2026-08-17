import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { fold, useSearch } from './search'
import { feature } from '../test/fixtures'
import type { FacilityFeature } from '../types/app'

describe('fold', () => {
  it('lowercases', () => {
    expect(fold('Savannah Fire')).toBe('savannah fire')
  })

  it('strips accents from decomposable letters', () => {
    expect(fold('München')).toBe('munchen')
    expect(fold('Pompiers d’Île-de-France')).toBe('pompiers d’ile-de-france')
  })

  it('spells out letters that do not decompose', () => {
    expect(fold('Loßburg')).toBe('lossburg')
    expect(fold('Ørsted')).toBe('orsted')
    expect(fold('Ærø')).toBe('aero')
    expect(fold('Œuvre')).toBe('oeuvre')
    expect(fold('Łódź')).toBe('lodz')
    expect(fold('Đakovo')).toBe('dakovo')
    expect(fold('Þingvellir')).toBe('thingvellir')
  })

  it('leaves plain ASCII alone', () => {
    expect(fold('station 1')).toBe('station 1')
  })

  it('is idempotent', () => {
    expect(fold(fold('Feuerwehr Loßburg'))).toBe(fold('Feuerwehr Loßburg'))
  })

  it('handles the empty string', () => {
    expect(fold('')).toBe('')
  })
})

describe('useSearch', () => {
  const search = (features: FacilityFeature[], query: string) =>
    renderHook(() => useSearch(features, query)).result.current

  const names = (features: FacilityFeature[]) => features.map((f) => f.properties.name)

  const FEATURES = [
    feature({ name: 'Savannah Fire Station 1', agency: { name: 'Savannah Fire' } }),
    feature({
      name: 'Memorial Health University Medical Center',
      agency: { name: 'Memorial Health' },
      specialties: ['trauma_major'],
    }),
    feature({ name: 'Feuerwehr Loßburg', agency: { name: 'Kreisfeuerwehr' } }),
    feature({ name: 'Merseyside Police HQ', agency: { name: 'Merseyside Police' }, designation: 'Canning Place' }),
  ]

  it('returns the input set untouched for a blank query', () => {
    expect(search(FEATURES, '')).toBe(FEATURES)
    expect(search(FEATURES, '   ')).toBe(FEATURES)
  })

  it('matches on the facility name', () => {
    expect(names(search(FEATURES, 'station 1'))).toContain('Savannah Fire Station 1')
  })

  it('matches on the agency name', () => {
    expect(names(search(FEATURES, 'memorial health'))).toContain(
      'Memorial Health University Medical Center',
    )
  })

  it('matches on a specialty tag', () => {
    expect(names(search(FEATURES, 'trauma_major'))).toContain(
      'Memorial Health University Medical Center',
    )
  })

  it('matches on the designation', () => {
    expect(names(search(FEATURES, 'canning place'))).toContain('Merseyside Police HQ')
  })

  it('finds an accented name from an ASCII keyboard', () => {
    expect(names(search(FEATURES, 'lossburg'))).toContain('Feuerwehr Loßburg')
  })

  it('finds a name typed with its accents too', () => {
    expect(names(search(FEATURES, 'Loßburg'))).toContain('Feuerwehr Loßburg')
  })

  it('ranks the best match first', () => {
    expect(names(search(FEATURES, 'merseyside'))[0]).toBe('Merseyside Police HQ')
  })

  it('returns nothing when nothing matches', () => {
    expect(search(FEATURES, 'zzzzzzzz')).toEqual([])
  })

  it('handles an empty feature set', () => {
    expect(search([], 'anything')).toEqual([])
  })
})
