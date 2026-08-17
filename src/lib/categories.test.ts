// The palette invariant in categories.ts is documented as computed, not chosen.
// This file is what enforces it: change a group color and CI fails here rather
// than waiting for someone to remember to re-run the checker by hand.
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  GROUP_META,
  GROUP_ORDER,
  categoryCode,
  categoryColor,
  categoryInk,
  categoryGroup,
  categoryLabel,
  groupMeta,
  type CategoryGroup,
} from './categories'
import { allPairs, chroma, contrast, deltaE, lightness } from '../test/color'
import type { Facility } from '../types/app'

type Category = Facility['category']

// The two surfaces markers actually sit on — `--surface` in src/index.css.
const SURFACES = { light: '#ffffff', dark: '#0f172a' } as const

// OKLCH lightness bands per mode. The dark band sits inside the light one,
// which is what makes a single mode-invariant palette possible at all.
const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] } as const

const CHROMA_FLOOR = 0.1
const CVD_TARGET = 8 // OKLab ΔE×100, min(protan, deutan), all pairs
const NORMAL_FLOOR = 15 // OKLab ΔE×100, normal vision, all pairs
const MARK_CONTRAST_MIN = 3 // WCAG, mark vs surface
const BADGE_CONTRAST_MIN = 4.5 // WCAG, code badge text on its own mark

const GROUPS = GROUP_ORDER.map((group) => ({ group, ...GROUP_META[group] }))
const PALETTE = GROUPS.map((g) => g.color)

describe('service-group palette', () => {
  it('has one color per group and no duplicates', () => {
    expect(PALETTE).toHaveLength(GROUP_ORDER.length)
    expect(new Set(PALETTE).size).toBe(PALETTE.length)
  })

  // A single value per group is *why* the palette is mode-invariant — there is
  // no second column that could drift out of validation.
  it.each(GROUPS)('$group sits in both lightness bands', ({ color }) => {
    const l = lightness(color)
    for (const [lo, hi] of [BAND.light, BAND.dark]) {
      expect(l).toBeGreaterThanOrEqual(lo)
      expect(l).toBeLessThanOrEqual(hi)
    }
  })

  it.each(GROUPS)('$group clears the chroma floor', ({ color }) => {
    expect(chroma(color)).toBeGreaterThanOrEqual(CHROMA_FLOOR)
  })

  // All-pairs, not adjacent: any two markers can sit side by side on a map.
  it('separates every pair under protanopia and deuteranopia', () => {
    for (const [a, b] of allPairs(GROUPS)) {
      const worst = Math.min(
        deltaE(a.color, b.color, 'protan'),
        deltaE(a.color, b.color, 'deutan'),
      )
      expect(worst, `${a.group} ↔ ${b.group}`).toBeGreaterThanOrEqual(CVD_TARGET)
    }
  })

  it('separates every pair under normal vision', () => {
    for (const [a, b] of allPairs(GROUPS)) {
      expect(deltaE(a.color, b.color), `${a.group} ↔ ${b.group}`).toBeGreaterThanOrEqual(
        NORMAL_FLOOR,
      )
    }
  })

  it.each(GROUPS)('$group reads against both surfaces', ({ color }) => {
    for (const surface of Object.values(SURFACES)) {
      expect(contrast(color, surface)).toBeGreaterThanOrEqual(MARK_CONTRAST_MIN)
    }
  })

  // The code badge is small bold text carrying real meaning, so it takes the
  // 4.5:1 text gate rather than the 3:1 non-text one.
  it.each(GROUPS)('$group ink is readable on its own mark', ({ color, ink }) => {
    expect(contrast(ink, color)).toBeGreaterThanOrEqual(BADGE_CONTRAST_MIN)
  })

  it('uses the neutral fallback for an out-of-vocabulary category', () => {
    const fallback = groupMeta('not_a_category' as Category)
    expect(PALETTE).not.toContain(fallback.color)
    for (const surface of Object.values(SURFACES)) {
      expect(contrast(fallback.color, surface)).toBeGreaterThanOrEqual(MARK_CONTRAST_MIN)
    }
    expect(contrast(fallback.ink, fallback.color)).toBeGreaterThanOrEqual(BADGE_CONTRAST_MIN)
  })
})

describe('category metadata', () => {
  const categories = Object.keys(CATEGORY_META) as Category[]

  it('orders every category exactly once', () => {
    expect([...CATEGORY_ORDER].sort()).toEqual([...categories].sort())
  })

  it('orders every group exactly once', () => {
    expect([...GROUP_ORDER].sort()).toEqual(
      (Object.keys(GROUP_META) as CategoryGroup[]).sort(),
    )
  })

  it('assigns every category to a known group', () => {
    for (const category of categories) {
      expect(GROUP_META).toHaveProperty(CATEGORY_META[category].group)
    }
  })

  // Color encodes the group, so the code badge is the *only* thing telling two
  // categories in the same group apart. Duplicates would erase that.
  it('gives every category a distinct 1–2 character code', () => {
    const codes = categories.map((c) => CATEGORY_META[c].code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[A-Z]{1,2}$/)
  })

  it('gives every category a distinct label', () => {
    const labels = categories.map((c) => CATEGORY_META[c].label)
    expect(new Set(labels).size).toBe(labels.length)
  })
})

describe('lookups', () => {
  it('resolve a known category', () => {
    expect(categoryLabel('hospital')).toBe('Hospital')
    expect(categoryCode('hospital')).toBe('H')
    expect(categoryGroup('hospital')).toBe('medical')
    expect(categoryColor('hospital')).toBe(GROUP_META.medical.color)
    expect(categoryInk('hospital')).toBe(GROUP_META.medical.ink)
  })

  it('degrade gracefully for an unknown category', () => {
    const unknown = 'not_a_category' as Category
    expect(categoryLabel(unknown)).toBe('not_a_category')
    expect(categoryCode(unknown)).toBe('?')
    expect(categoryGroup(unknown)).toBeNull()
    expect(categoryColor(unknown)).toBe(groupMeta(unknown).color)
  })

  it('agrees with groupMeta for every category', () => {
    for (const category of CATEGORY_ORDER) {
      expect(categoryColor(category)).toBe(groupMeta(category).color)
      expect(categoryInk(category)).toBe(groupMeta(category).ink)
    }
  })
})
