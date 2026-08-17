import { describe, expect, it } from 'vitest'
import { bboxOf, featureCoords, toPosition } from './geo'
import { feature } from '../test/fixtures'

describe('featureCoords', () => {
  it('reads [lng, lat] off a feature', () => {
    expect(featureCoords(feature({}, [-81.0912, 32.0809]))).toEqual([-81.0912, 32.0809])
  })

  it('coerces the schema-typed unknowns to numbers', () => {
    const f = feature()
    f.geometry.coordinates = ['-81.09', '32.08'] as unknown as [unknown, unknown]
    expect(featureCoords(f)).toEqual([-81.09, 32.08])
  })
})

describe('toPosition', () => {
  it('passes a numeric pair through', () => {
    expect(toPosition([-2.99, 53.41])).toEqual([-2.99, 53.41])
  })

  it('returns null for undefined', () => {
    expect(toPosition(undefined)).toBeNull()
  })

  it('returns null when either half is not a number', () => {
    expect(toPosition(['-2.99', 53.41])).toBeNull()
    expect(toPosition([-2.99, null])).toBeNull()
  })

  it('accepts zero', () => {
    expect(toPosition([0, 0])).toEqual([0, 0])
  })
})

describe('bboxOf', () => {
  it('returns null for an empty set', () => {
    expect(bboxOf([])).toBeNull()
  })

  it('returns a degenerate box for a single feature', () => {
    expect(bboxOf([feature({}, [-81, 32])])).toEqual([-81, 32, -81, 32])
  })

  it('covers every feature as [west, south, east, north]', () => {
    const features = [
      feature({}, [-81.2, 32.1]),
      feature({}, [-80.9, 31.9]),
      feature({}, [-81.0, 32.3]),
    ]
    expect(bboxOf(features)).toEqual([-81.2, 31.9, -80.9, 32.3])
  })

  it('handles coordinates spanning the prime meridian', () => {
    expect(bboxOf([feature({}, [-0.5, 51.5]), feature({}, [0.5, 51.4])])).toEqual([
      -0.5, 51.4, 0.5, 51.5,
    ])
  })
})
