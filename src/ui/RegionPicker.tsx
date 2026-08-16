import type { RegionIndexEntry } from '../types/app'

interface Props {
  regions: RegionIndexEntry[]
  value: string
  onChange: (regionId: string) => void
}

export function RegionPicker({ regions, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-ink-muted">Region</span>
      <select
        className="max-w-52 truncate rounded-md border border-hairline-strong bg-surface px-2 py-1 text-ink shadow-sm focus:border-accent-strong focus:outline-none"
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
