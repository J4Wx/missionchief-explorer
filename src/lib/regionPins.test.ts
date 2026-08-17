import { describe, expect, it } from 'vitest'
import { pinBounds, pinnedFacilityCount, regionPins } from './regionPins'
import { regionEntry } from '../test/fixtures'

const savannah = regionEntry({
  region_id: 'us-ga-savannah',
  name: 'Savannah',
  center: [-81.1, 32.05],
  facility_count: 58,
})
const liverpool = regionEntry({
  region_id: 'gb-mersey-liverpool',
  name: 'Liverpool',
  country: 'GB',
  center: [-2.92, 53.45],
  facility_count: 72,
})

describe('regionPins', () => {
  it('turns registry entries into pins, in registry order', () => {
    expect(regionPins([savannah, liverpool])).toEqual([
      { entry: savannah, center: [-81.1, 32.05], count: 58 },
      { entry: liverpool, center: [-2.92, 53.45], count: 72 },
    ])
  })

  it('drops an entry with nowhere to sit', () => {
    const queued = regionEntry({ region_id: 'us-tx-austin', status: 'requested' })
    expect(regionPins([savannah, queued]).map((p) => p.entry.region_id)).toEqual([
      'us-ga-savannah',
    ])
  })

  it('pins a region whose count is unrecorded, with no count', () => {
    const entry = regionEntry({ center: [-81.1, 32.05] })
    expect(regionPins([entry])).toEqual([{ entry, center: [-81.1, 32.05], count: null }])
  })

  it('frames every pin', () => {
    expect(pinBounds(regionPins([savannah, liverpool]))).toEqual([-81.1, 32.05, -2.92, 53.45])
  })

  it('has nothing to frame without pins', () => {
    expect(pinBounds([])).toBeNull()
  })

  it('totals the facilities behind the pins, counting an unknown as none', () => {
    const uncounted = regionEntry({ region_id: 'us-il-springfield', center: [-89.65, 39.8] })
    expect(pinnedFacilityCount(regionPins([savannah, liverpool, uncounted]))).toBe(130)
  })
})
