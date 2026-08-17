import { describe, expect, it } from 'vitest'
import { addressLines, countyLabel } from './address'
import type { Facility } from '../types/app'

type Address = Facility['address']

const address = (over: Partial<Address> & Pick<Address, 'country'>): Address => ({
  city: '',
  ...over,
})

describe('addressLines', () => {
  it('puts the US postal code after the state', () => {
    expect(
      addressLines(
        address({ street: '121 Habersham St', city: 'Savannah', state: 'GA', postal_code: '31401', country: 'US' }),
      ),
    ).toEqual(['121 Habersham St', 'Savannah, GA 31401'])
  })

  it('gives the UK postcode its own line, after the post town and county', () => {
    expect(
      addressLines(
        address({ street: 'Canning Place', city: 'Liverpool', county: 'Merseyside', postal_code: 'L1 8JX', country: 'GB' }),
      ),
    ).toEqual(['Canning Place', 'Liverpool', 'L1 8JX'])
  })

  it('leads with the postal code for a country with no recorded convention', () => {
    expect(
      addressLines(address({ street: 'Voltairestraße 2', city: 'Berlin', postal_code: '10115', country: 'DE' })),
    ).toEqual(['Voltairestraße 2', '10115 Berlin'])
  })

  it('shares the US convention with the other after-region countries', () => {
    for (const country of ['CA', 'AU', 'NZ']) {
      expect(addressLines(address({ city: 'Springfield', state: 'ON', postal_code: 'X1X 1X1', country }))).toEqual([
        'Springfield, ON X1X 1X1',
      ])
    }
  })

  it('keeps a first-level area on its own line under the leading-postcode convention', () => {
    expect(addressLines(address({ city: 'Lyon', state: 'Rhône', postal_code: '69001', country: 'FR' }))).toEqual([
      '69001 Lyon',
      'Rhône',
    ])
  })

  it('drops the parts a record does not carry', () => {
    expect(addressLines(address({ city: 'Savannah', state: 'GA', country: 'US' }))).toEqual([
      'Savannah, GA',
    ])
    expect(addressLines(address({ city: 'Savannah', postal_code: '31401', country: 'US' }))).toEqual([
      'Savannah, 31401',
    ])
    expect(addressLines(address({ city: 'Liverpool', country: 'GB' }))).toEqual(['Liverpool'])
  })

  it('returns no lines when there is nothing to render', () => {
    expect(addressLines(address({ country: 'US' }))).toEqual([])
    expect(addressLines(address({ country: 'GB' }))).toEqual([])
  })

  it('trims whitespace-only parts away', () => {
    expect(
      addressLines(address({ street: '  ', city: ' Savannah ', state: ' GA ', country: 'US' })),
    ).toEqual(['Savannah, GA'])
  })
})

describe('countyLabel', () => {
  it('appends the local word for the second-level area', () => {
    expect(countyLabel(address({ county: 'Chatham', country: 'US' }))).toBe('Chatham County')
  })

  it('leaves a value that already spells the word out', () => {
    expect(countyLabel(address({ county: 'Chatham County', country: 'US' }))).toBe('Chatham County')
    expect(countyLabel(address({ county: 'Chatham COUNTY', country: 'US' }))).toBe('Chatham COUNTY')
  })

  it('appends nothing where the convention has no suffix', () => {
    expect(countyLabel(address({ county: 'Merseyside', country: 'GB' }))).toBe('Merseyside')
    expect(countyLabel(address({ county: 'Rhône', country: 'FR' }))).toBe('Rhône')
  })

  it('is null when no second-level area is recorded', () => {
    expect(countyLabel(address({ country: 'US' }))).toBeNull()
    expect(countyLabel(address({ county: '   ', country: 'US' }))).toBeNull()
  })
})
