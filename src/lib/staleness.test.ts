import { describe, expect, it } from 'vitest'
import { ageInDays, formatReviewAge, reviewsByAge, stalestRegions, todayIso } from './staleness'
import { regionEntry } from '../test/fixtures'

const AS_OF = '2026-08-18'

const entry = (region_id: string, last_reviewed?: string, over = {}) =>
  regionEntry({ region_id, name: region_id, last_reviewed, ...over })

describe('ageInDays', () => {
  it('measures whole days against the given date', () => {
    expect(ageInDays('2026-08-01', AS_OF)).toBe(17)
    expect(ageInDays(AS_OF, AS_OF)).toBe(0)
  })

  it('has no answer for a region that never recorded one', () => {
    expect(ageInDays(undefined, AS_OF)).toBeNull()
    expect(ageInDays('not a date', AS_OF)).toBeNull()
  })
})

describe('reviewsByAge', () => {
  it('ranks the longest-unreviewed region first', () => {
    const ranked = reviewsByAge(
      [entry('b', '2026-08-17'), entry('a', '2026-01-04'), entry('c', '2026-08-10')],
      AS_OF,
    )
    expect(ranked.map((r) => r.entry.region_id)).toEqual(['a', 'c', 'b'])
    expect(ranked[0].ageDays).toBe(226)
  })

  it('puts a region with no recorded review ahead of every dated one', () => {
    // Not knowing when it was last worked is the strongest case for working it.
    const ranked = reviewsByAge([entry('dated', '2020-01-01'), entry('unknown')], AS_OF)
    expect(ranked.map((r) => r.entry.region_id)).toEqual(['unknown', 'dated'])
    expect(ranked[0].ageDays).toBeNull()
  })

  it('breaks ties on region_id so the order does not jitter between renders', () => {
    const ranked = reviewsByAge([entry('z', '2026-08-01'), entry('a', '2026-08-01')], AS_OF)
    expect(ranked.map((r) => r.entry.region_id)).toEqual(['a', 'z'])
  })

  it('only ranks published regions — a queued request has nothing to review', () => {
    const ranked = reviewsByAge(
      [entry('queued', undefined, { status: 'requested' }), entry('live', '2026-08-01')],
      AS_OF,
    )
    expect(ranked.map((r) => r.entry.region_id)).toEqual(['live'])
  })
})

describe('stalestRegions', () => {
  it('takes the oldest few', () => {
    const entries = [
      entry('a', '2026-01-01'),
      entry('b', '2026-02-01'),
      entry('c', '2026-03-01'),
      entry('d', '2026-04-01'),
    ]
    expect(stalestRegions(entries, AS_OF, 2).map((r) => r.entry.region_id)).toEqual(['a', 'b'])
  })

  it('is empty when nothing is published, rather than inventing a suggestion', () => {
    expect(stalestRegions([entry('q', undefined, { status: 'requested' })], AS_OF)).toEqual([])
  })
})

describe('formatReviewAge', () => {
  it('reads as a plain-language age', () => {
    expect(formatReviewAge(null)).toBe('never reviewed')
    expect(formatReviewAge(0)).toBe('reviewed today')
    expect(formatReviewAge(1)).toBe('reviewed yesterday')
    expect(formatReviewAge(9)).toBe('reviewed 9 days ago')
    expect(formatReviewAge(90)).toBe('reviewed 3 months ago')
    expect(formatReviewAge(800)).toBe('reviewed 2 years ago')
  })
})

describe('todayIso', () => {
  it('is the date part of an ISO timestamp', () => {
    expect(todayIso(new Date('2026-08-18T22:15:00Z'))).toBe('2026-08-18')
  })
})
