// Presentation metadata for facility categories.
//
// Color encodes the *service group* (fire / medical / law enforcement /
// corrections / support), not the individual category: 14 simultaneously
// distinguishable hues do not exist. Each category then carries its own short
// code badge, so identity is never conveyed by color alone (see docs/05).
//
// The five group colors are taken from the dataviz skill's documented palette
// and validated with its checker on the *all-pairs* pairlist (any two markers
// can sit side by side on a map):
//   validate_palette.js "#e34948,#008300,#2a78d6,#4a3aa7,#eda100" \
//     --mode light --pairs all   → all checks pass
// Two WARNs are relieved by the per-category code badge and the legend labels:
// the fire↔medical CVD pair sits in the 6–8 floor band, and the support yellow
// is below 3:1 on a light surface. Dark-mode steps are deliberately deferred to
// the Phase 5 theming pass — the dark column of the same palette does not clear
// all-pairs for five slots, so that pass has to re-pick, not just flip.
import type { Facility } from '../types/app'

type Category = Facility['category']

export type CategoryGroup = 'fire' | 'medical' | 'law' | 'corrections' | 'support'

export interface GroupMeta {
  label: string
  /** Marker/swatch fill. */
  color: string
  /** Text color that meets contrast on `color`. */
  ink: string
}

export const GROUP_META: Record<CategoryGroup, GroupMeta> = {
  fire: { label: 'Fire', color: '#e34948', ink: '#ffffff' },
  medical: { label: 'Medical', color: '#008300', ink: '#ffffff' },
  law: { label: 'Law enforcement', color: '#2a78d6', ink: '#ffffff' },
  corrections: { label: 'Corrections', color: '#4a3aa7', ink: '#ffffff' },
  support: { label: 'Support', color: '#eda100', ink: '#1a1a19' },
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
  ems: { label: 'EMS', group: 'medical', code: 'EM' },
  hospital: { label: 'Hospital', group: 'medical', code: 'H' },
  clinic: { label: 'Clinic', group: 'medical', code: 'CL' },
  police_local: { label: 'Police', group: 'law', code: 'PD' },
  sheriff: { label: 'Sheriff', group: 'law', code: 'SO' },
  state_le: { label: 'State LE', group: 'law', code: 'ST' },
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
