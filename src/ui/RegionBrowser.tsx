// Region browser — the keyboard-reachable twin of the global map, in the place
// the facility list occupies once a region is open.
//
// It lists the same published regions the map pins, grouped country → division
// by the tree the region picker uses (src/lib/regionTree.ts), so the coverage
// reads as a hierarchy rather than a flat list of cities. Rows are buttons:
// the map is pointer-only, this is how the same choice is made without one.
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { RegionIndexEntry } from '../types/app'
import { buildRegionTree, type RegionNode } from '../lib/regionTree'

interface Props {
  regions: RegionIndexEntry[]
  hoveredId: string | null
  onSelect: (regionId: string) => void
  onHover: (regionId: string | null) => void
}

/** Indent per level, in px — matching the region picker's ramp. */
const INDENT = 12

export function RegionBrowser({ regions, hoveredId, onSelect, onHover }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Arrow keys move between rows, as in the facility list (docs/05).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('[data-region-id]') ?? [],
    )
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return
    const next = rows[current + (e.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  if (regions.length === 0) {
    return <p className="p-6 text-ink-faint">No regions are published yet.</p>
  }

  const renderNodes = (nodes: RegionNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'region') {
        const entry = node.entry
        const count = entry.facility_count
        return (
          <button
            key={entry.region_id}
            type="button"
            data-region-id={entry.region_id}
            onClick={() => onSelect(entry.region_id)}
            onMouseEnter={() => onHover(entry.region_id)}
            onFocus={() => onHover(entry.region_id)}
            style={{ paddingLeft: 16 + depth * INDENT }}
            className={`flex w-full items-baseline gap-2 py-2 pr-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-strong ${
              entry.region_id === hoveredId ? 'bg-surface-3' : 'hover:bg-surface-3'
            }`}
          >
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{entry.name}</span>
            {count != null && (
              <span className="shrink-0 text-xs text-ink-faint">
                {count} facilit{count === 1 ? 'y' : 'ies'}
              </span>
            )}
          </button>
        )
      }

      return (
        <div key={node.id} role="group" aria-label={node.label}>
          <div
            aria-hidden="true"
            style={{ paddingLeft: 16 + depth * INDENT }}
            className="flex items-center gap-2 pr-4 pb-0.5 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted"
          >
            <span className="truncate">{node.label}</span>
            <span className="ml-auto shrink-0 font-normal normal-case tracking-normal text-ink-faint">
              {node.count}
            </span>
          </div>
          {renderNodes(node.children, depth + 1)}
        </div>
      )
    })

  return (
    <div ref={rootRef} onKeyDown={onKeyDown} onMouseLeave={() => onHover(null)} className="pb-3">
      {renderNodes(buildRegionTree(regions), 0)}
    </div>
  )
}
