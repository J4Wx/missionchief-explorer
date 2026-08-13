import type { Subregion } from '../types/app'

interface Props {
  subregions: Subregion[]
  counts: Record<string, number>
  value: string // 'all' or a subregion id
  onChange: (value: string) => void
}

/**
 * Local-level narrowing within a region. Only rendered when the region declares
 * sub-regions. Nested sub-regions are indented under their parent.
 */
export function SubregionFilter({ subregions, counts, value, onChange }: Props) {
  if (subregions.length === 0) return null

  // Order roots first, then their children, so indentation reads correctly.
  const roots = subregions.filter((s) => s.parent == null)
  const ordered: { sub: Subregion; depth: number }[] = []
  const pushWithChildren = (sub: Subregion, depth: number) => {
    ordered.push({ sub, depth })
    for (const child of subregions.filter((s) => s.parent === sub.id)) {
      pushWithChildren(child, depth + 1)
    }
  }
  roots.forEach((r) => pushWithChildren(r, 0))

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">Sub-region</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All ({total})</option>
        {ordered.map(({ sub, depth }) => (
          <option key={sub.id} value={sub.id}>
            {`${'  '.repeat(depth)}${sub.name} (${counts[sub.id] ?? 0})`}
          </option>
        ))}
      </select>
    </label>
  )
}
