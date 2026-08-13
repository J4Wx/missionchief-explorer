import type { FacilityFeature } from '../types/app'
import { categoryColor, categoryLabel } from '../lib/categories'

interface Props {
  features: FacilityFeature[]
  subregionName: (id: string | null | undefined) => string | null
}

export function FacilityList({ features, subregionName }: Props) {
  if (features.length === 0) {
    return <p className="p-6 text-slate-500">No facilities match the current selection.</p>
  }

  return (
    <ul className="divide-y divide-slate-200">
      {features.map((f) => {
        const p = f.properties
        const sub = subregionName(p.subregion_id)
        const units = p.units
          .map((u) => `${u.count && u.count > 1 ? `${u.count}× ` : ''}${u.designation ?? u.type}`)
          .join(', ')
        return (
          <li key={p.id} className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50">
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: categoryColor(p.category) }}
              >
                {categoryLabel(p.category)}
              </span>
              <span className="font-medium text-slate-900">{p.name}</span>
              {p.designation && (
                <span className="text-xs text-slate-500">· {p.designation}</span>
              )}
              {sub && (
                <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                  {sub}
                </span>
              )}
            </div>
            <div className="text-sm text-slate-600">{p.agency.name}</div>
            {units && <div className="text-sm text-slate-500">Units: {units}</div>}
            {p.specialties && p.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {p.specialties.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
