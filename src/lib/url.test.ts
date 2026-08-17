import { beforeEach, describe, expect, it } from 'vitest'
import { parseUrl, serializeState, writeUrl, type UrlState } from './url'
import { EMPTY_FILTERS } from './filters'

const CLEARED: UrlState = {
  regionId: null,
  subregionId: null,
  filters: EMPTY_FILTERS,
  selectedId: null,
  about: false,
}

const state = (over: Partial<UrlState> = {}): UrlState => ({ ...CLEARED, ...over })

describe('parseUrl', () => {
  it('reads every dimension out of the query string', () => {
    const parsed = parseUrl(
      '?region=us-ga-savannah&sub=downtown&cat=fire&cat=ems&agency=Savannah+Fire' +
        '&spec=hazmat&staff=volunteer&status=closed&q=engine&sel=fire-1&about=1',
    )
    expect(parsed).toEqual({
      regionId: 'us-ga-savannah',
      subregionId: 'downtown',
      filters: {
        categories: ['fire', 'ems'],
        agencies: ['Savannah Fire'],
        specialties: ['hazmat'],
        staffing: ['volunteer'],
        statuses: ['closed'],
        query: 'engine',
      },
      selectedId: 'fire-1',
      about: true,
    })
  })

  it('yields the cleared state for an empty query string', () => {
    expect(parseUrl('')).toEqual(CLEARED)
    expect(parseUrl('?')).toEqual(CLEARED)
  })

  it('ignores parameters it does not know', () => {
    expect(parseUrl('?utm_source=forum&region=us-ga-savannah&fbclid=abc')).toEqual(
      state({ regionId: 'us-ga-savannah' }),
    )
  })

  it('treats any `about` value other than 1 as closed', () => {
    expect(parseUrl('?about=1').about).toBe(true)
    expect(parseUrl('?about=true').about).toBe(false)
    expect(parseUrl('?about=0').about).toBe(false)
  })

  it('accepts a leading ? or not', () => {
    expect(parseUrl('region=us-ga-savannah')).toEqual(state({ regionId: 'us-ga-savannah' }))
  })
})

describe('serializeState', () => {
  it('writes nothing for the cleared state', () => {
    expect(serializeState(CLEARED)).toBe('')
  })

  it('repeats a key per value within a facet', () => {
    const qs = serializeState(state({ filters: { ...EMPTY_FILTERS, categories: ['fire', 'ems'] } }))
    expect(new URLSearchParams(qs).getAll('cat')).toEqual(['fire', 'ems'])
  })

  it('omits the `all` sub-region sentinel', () => {
    expect(serializeState(state({ subregionId: 'all' }))).toBe('')
    expect(serializeState(state({ subregionId: 'downtown' }))).toBe('sub=downtown')
  })

  it('trims the query and drops it when blank', () => {
    expect(serializeState(state({ filters: { ...EMPTY_FILTERS, query: '  engine  ' }}))).toBe(
      'q=engine',
    )
    expect(serializeState(state({ filters: { ...EMPTY_FILTERS, query: '   ' } }))).toBe('')
  })

  it('omits `about` when the dialog is closed', () => {
    expect(serializeState(state({ about: false }))).toBe('')
    expect(serializeState(state({ about: true }))).toBe('about=1')
  })
})

describe('round trip', () => {
  const cases: [string, UrlState][] = [
    ['cleared', CLEARED],
    ['region only', state({ regionId: 'gb-mersey-liverpool' })],
    ['region + sub-region', state({ regionId: 'us-sc-charleston', subregionId: 'downtown' })],
    [
      'every facet',
      state({
        regionId: 'us-ga-savannah',
        subregionId: 'islands',
        filters: {
          categories: ['fire', 'hospital'],
          agencies: ['Savannah Fire & Emergency Services'],
          specialties: ['hazmat', 'trauma_major'],
          staffing: ['career', 'volunteer'],
          statuses: ['active', 'closed'],
          query: 'station 1',
        },
        selectedId: 'sfd-station-1',
        about: true,
      }),
    ],
    [
      'values needing escaping',
      state({
        filters: { ...EMPTY_FILTERS, agencies: ['A & B / C', 'D?E=F#G'], query: 'a+b c' },
      }),
    ],
  ]

  it.each(cases)('survives serialize → parse: %s', (_name, original) => {
    expect(parseUrl(`?${serializeState(original)}`)).toEqual(original)
  })
})

describe('writeUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/atlas/')
  })

  it('reflects the state into the address bar', () => {
    writeUrl(state({ regionId: 'us-ga-savannah' }))
    expect(window.location.search).toBe('?region=us-ga-savannah')
    expect(window.location.pathname).toBe('/atlas/')
  })

  it('leaves a clean URL when the state is cleared', () => {
    writeUrl(state({ regionId: 'us-ga-savannah' }))
    writeUrl(CLEARED)
    expect(window.location.search).toBe('')
    expect(window.location.href).toMatch(/\/atlas\/$/)
  })

  it('preserves the path and hash', () => {
    window.history.replaceState(null, '', '/atlas/#map')
    writeUrl(state({ regionId: 'us-ga-savannah' }))
    expect(window.location.pathname).toBe('/atlas/')
    expect(window.location.hash).toBe('#map')
  })

  it('adds no history entry', () => {
    const before = window.history.length
    writeUrl(state({ regionId: 'us-ga-savannah' }))
    writeUrl(state({ regionId: 'us-sc-charleston' }))
    expect(window.history.length).toBe(before)
  })
})
