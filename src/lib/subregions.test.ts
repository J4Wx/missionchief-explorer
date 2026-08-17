import { describe, expect, it } from 'vitest'
import { subtreeIds } from './subregions'
import { subregion } from '../test/fixtures'

// borough › neighborhood › block, plus an unrelated sibling borough.
const NESTED = [
  subregion({ id: 'downtown' }),
  subregion({ id: 'historic', parent: 'downtown' }),
  subregion({ id: 'river-street', parent: 'historic' }),
  subregion({ id: 'islands' }),
]

describe('subtreeIds', () => {
  it('includes the root itself', () => {
    expect(subtreeIds([subregion({ id: 'islands' })], 'islands')).toEqual(new Set(['islands']))
  })

  it('includes descendants at every depth', () => {
    expect(subtreeIds(NESTED, 'downtown')).toEqual(
      new Set(['downtown', 'historic', 'river-street']),
    )
  })

  it('excludes siblings and ancestors', () => {
    expect(subtreeIds(NESTED, 'historic')).toEqual(new Set(['historic', 'river-street']))
  })

  it('returns just the id when the root has no children', () => {
    expect(subtreeIds(NESTED, 'river-street')).toEqual(new Set(['river-street']))
  })

  it('returns just the id for a root that is not in the list', () => {
    expect(subtreeIds(NESTED, 'nowhere')).toEqual(new Set(['nowhere']))
  })

  it('handles an empty sub-region list', () => {
    expect(subtreeIds([], 'downtown')).toEqual(new Set(['downtown']))
  })

  it('treats an explicit null parent as a root', () => {
    const subs = [subregion({ id: 'a', parent: null }), subregion({ id: 'b', parent: 'a' })]
    expect(subtreeIds(subs, 'a')).toEqual(new Set(['a', 'b']))
  })

  // `npm run validate` rejects cycles, but the UI must not hang on one.
  it('terminates on a parent cycle', () => {
    const cyclic = [
      subregion({ id: 'a', parent: 'b' }),
      subregion({ id: 'b', parent: 'a' }),
      subregion({ id: 'c', parent: 'b' }),
    ]
    expect(subtreeIds(cyclic, 'a')).toEqual(new Set(['a', 'b', 'c']))
  })

  it('terminates on a self-parent', () => {
    expect(subtreeIds([subregion({ id: 'a', parent: 'a' })], 'a')).toEqual(new Set(['a']))
  })
})
