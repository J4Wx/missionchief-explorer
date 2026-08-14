// Sub-region hierarchy helpers. Sub-regions may nest via `parent`, and
// selecting one narrows to that sub-region *and its descendants* (docs/05), so
// picking a borough also shows the neighborhoods inside it.
import type { Subregion } from '../types/app'

/**
 * The given sub-region id plus every id beneath it. Tolerates cycles, which
 * `npm run validate` rejects but the UI shouldn't hang on.
 */
export function subtreeIds(subregions: Subregion[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>()
  for (const sub of subregions) {
    if (sub.parent == null) continue
    const siblings = childrenOf.get(sub.parent) ?? []
    siblings.push(sub.id)
    childrenOf.set(sub.parent, siblings)
  }

  const ids = new Set<string>()
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.pop() as string
    if (ids.has(id)) continue
    ids.add(id)
    queue.push(...(childrenOf.get(id) ?? []))
  }
  return ids
}
