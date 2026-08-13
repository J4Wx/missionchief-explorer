import type { RegionIndexEntry } from '../types/app'

interface Props {
  regions: RegionIndexEntry[]
  value: string
  onChange: (regionId: string) => void
}

export function RegionPicker({ regions, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">Region</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {regions.map((r) => (
          <option key={r.region_id} value={r.region_id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  )
}
