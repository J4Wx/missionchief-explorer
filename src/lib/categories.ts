// Presentation metadata for facility categories.
//
// Color encodes the *service group* (fire / medical / law enforcement /
// corrections / support), not the individual category: 14 simultaneously
// distinguishable hues do not exist. Each category then carries its own short
// code badge, so identity is never conveyed by color alone (see docs/05).
//
// The five group colors are a **mode-invariant** palette: one set of steps that
// clears every gate on both surfaces, so a marker means the same thing in light
// and dark. That is possible because the dark lightness band (OKLCH L
// 0.485–0.665) sits inside the light one — steps chosen for dark satisfy both.
// Validated with the dataviz skill's checker on the *all-pairs* pairlist (any
// two markers can sit side by side on a map), against this app's own surfaces:
//   validate_palette.js "#be384f,#b38007,#09a773,#3a7deb,#a158b9" \
//     --mode light --surface "#ffffff" --pairs all   → all 6 checks PASS
//   validate_palette.js "#be384f,#b38007,#09a773,#3a7deb,#a158b9" \
//     --mode dark  --surface "#0f172a" --pairs all   → all 6 checks PASS
// Worst all-pairs CVD ΔE 9.1 (deutan, medical↔fire) — above the ≥8 target, not
// merely in the 6–8 floor band; worst normal-vision ΔE 16.5 (≥15 floor); every
// step ≥3:1 on both surfaces, so no contrast relief is being leaned on. The
// code badge is still the non-color half of the encoding, not a mitigation.
//
// Re-picked in the Phase 5 theming pass: the previous palette was light-only
// and its dark column collapsed violet↔blue (ΔE 1.9). No five-hue subset of the
// skill's documented eight passes all-pairs in dark, so these steps were
// derived by constrained search inside the dark band — each group holding its
// semantic hue (fire red, medical green, law blue, corrections purple, support
// amber) — and then validated as a set. Changing any of them means re-running
// the checker on both modes; don't eyeball it.
import type { Facility } from '../types/app'

type Category = Facility['category']

export type CategoryGroup = 'fire' | 'medical' | 'law' | 'corrections' | 'support'

export interface GroupMeta {
  label: string
  /** Marker/swatch fill. Same value in both themes — see the note above. */
  color: string
  /**
   * Badge/marker text color on top of `color`. Whichever of the two neutrals
   * scores higher; each pairing clears 4.5:1, since the code badge is small
   * bold text carrying real meaning.
   */
  ink: string
}

export const GROUP_META: Record<CategoryGroup, GroupMeta> = {
  // Labelled "Fire & rescue", not "Fire": schema_version 2 added sea/mountain
  // rescue and civil protection, which are rescue services rather than fire
  // brigades. They join this group deliberately — a *sixth* group would mean
  // re-deriving the whole mode-invariant palette, and the label carries the
  // widened meaning at no cost to the colors.
  fire: { label: 'Fire & rescue', color: '#be384f', ink: '#ffffff' }, // 5.43:1
  medical: { label: 'Medical', color: '#09a773', ink: '#0f172a' }, // 5.77:1
  law: { label: 'Law enforcement', color: '#3a7deb', ink: '#0f172a' }, // 4.52:1
  corrections: { label: 'Corrections', color: '#a158b9', ink: '#ffffff' }, // 4.55:1
  support: { label: 'Support', color: '#b38007', ink: '#0f172a' }, //  5.11:1
}

/** Group order for the legend — matches GROUP_META insertion order. */
export const GROUP_ORDER: CategoryGroup[] = [
  'fire',
  'medical',
  'law',
  'corrections',
  'support',
]

export interface CategoryMeta {
  label: string
  group: CategoryGroup
  /** 1–2 character marker badge; the non-color half of the encoding. */
  code: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  fire: { label: 'Fire', group: 'fire', code: 'FD' },
  sea_rescue: { label: 'Sea rescue', group: 'fire', code: 'SR' },
  mountain_rescue: { label: 'Mountain rescue', group: 'fire', code: 'MR' },
  civil_protection: { label: 'Civil protection', group: 'fire', code: 'CP' },
  ems: { label: 'EMS', group: 'medical', code: 'EM' },
  hospital: { label: 'Hospital', group: 'medical', code: 'H' },
  clinic: { label: 'Clinic', group: 'medical', code: 'CL' },
  police_local: { label: 'Police', group: 'law', code: 'PD' },
  sheriff: { label: 'Sheriff', group: 'law', code: 'SO' },
  state_le: { label: 'State LE', group: 'law', code: 'ST' },
  police_national: { label: 'National police', group: 'law', code: 'NP' },
  federal_le: { label: 'Federal LE', group: 'law', code: 'FE' },
  coast_guard: { label: 'Coast Guard', group: 'law', code: 'CG' },
  ranger: { label: 'Ranger', group: 'law', code: 'RG' },
  prison: { label: 'Prison', group: 'corrections', code: 'PR' },
  jail: { label: 'Jail', group: 'corrections', code: 'JL' },
  tow: { label: 'Tow', group: 'support', code: 'TW' },
  dispatch: { label: 'Dispatch', group: 'support', code: 'DP' },
}

/** Category order for the legend, grouped by service group. */
export const CATEGORY_ORDER = Object.keys(CATEGORY_META) as Category[]

// Out-of-vocabulary categories only (the schema enum should make this
// unreachable) — a deliberate neutral rather than a sixth group color, so a
// record with a bad `category` looks unclassified instead of misclassified.
// Clears 3:1 on both surfaces (4.83 light / 3.69 dark) with white ink at 4.83.
const FALLBACK: GroupMeta = { label: 'Other', color: '#6b7280', ink: '#ffffff' }

export function categoryLabel(category: Category): string {
  return CATEGORY_META[category]?.label ?? category
}

export function categoryCode(category: Category): string {
  return CATEGORY_META[category]?.code ?? '?'
}

export function categoryGroup(category: Category): CategoryGroup | null {
  return CATEGORY_META[category]?.group ?? null
}

export function groupMeta(category: Category): GroupMeta {
  const group = CATEGORY_META[category]?.group
  return group ? GROUP_META[group] : FALLBACK
}

/** Marker/badge fill for a category (its group's color). */
export function categoryColor(category: Category): string {
  return groupMeta(category).color
}

/** Readable text color on top of `categoryColor(category)`. */
export function categoryInk(category: Category): string {
  return groupMeta(category).ink
}
