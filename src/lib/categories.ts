// Presentation metadata for facility categories. Colors are chosen to be
// distinguishable and are paired with a short label so category is never
// conveyed by color alone (accessibility). Reused by the map in Phase 2.
import type { Facility } from '../types/app'

type Category = Facility['category']

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  fire: { label: 'Fire', color: '#e11d48' },
  ems: { label: 'EMS', color: '#f59e0b' },
  police_local: { label: 'Police', color: '#2563eb' },
  sheriff: { label: 'Sheriff', color: '#1d4ed8' },
  state_le: { label: 'State LE', color: '#7c3aed' },
  federal_le: { label: 'Federal LE', color: '#4338ca' },
  hospital: { label: 'Hospital', color: '#059669' },
  clinic: { label: 'Clinic', color: '#10b981' },
  prison: { label: 'Prison', color: '#78716c' },
  jail: { label: 'Jail', color: '#57534e' },
  tow: { label: 'Tow', color: '#ca8a04' },
  dispatch: { label: 'Dispatch', color: '#0891b2' },
  coast_guard: { label: 'Coast Guard', color: '#0284c7' },
  ranger: { label: 'Ranger', color: '#65a30d' },
}

export function categoryLabel(category: Category): string {
  return CATEGORY_META[category]?.label ?? category
}

export function categoryColor(category: Category): string {
  return CATEGORY_META[category]?.color ?? '#6b7280'
}
