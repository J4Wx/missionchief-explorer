// Results list — the keyboard-reachable twin of the map. Rows are buttons so
// the whole list works without a pointer (the map's non-pointer fallback), and
// hover/selection are reported up so the map can highlight the same facility.
import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { FacilityFeature } from '../types/app'
import { categoryCode, categoryInk, categoryLabel, groupMeta } from '../lib/categories'

interface Props {
  features: FacilityFeature[]
  subregionName: (id: string | null | undefined) => string | null
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

export function FacilityList({
  features,
  subregionName,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: Props) {
  const listRef = useRef<HTMLUListElement>(null)

  // Keep the selected row visible when the selection comes from the map.
  useEffect(() => {
    if (!selectedId) return
    const row = listRef.current?.querySelector(`[data-facility-id="${CSS.escape(selectedId)}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  // Arrow keys move between rows (docs/05).
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[data-facility-id]') ?? [],
    )
    const current = rows.indexOf(document.activeElement as HTMLButtonElement)
    if (current === -1) return
    const next = rows[current + (e.key === 'ArrowDown' ? 1 : -1)]
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  if (features.length === 0) {
    return <p className="p-6 text-ink-faint">No facilities match the current selection.</p>
  }

  return (
    <ul
      ref={listRef}
      onKeyDown={onKeyDown}
      onMouseLeave={() => onHover(null)}
      className="divide-y divide-hairline"
    >
      {features.map((f) => {
        const p = f.properties
        const sub = subregionName(p.subregion_id)
        const group = groupMeta(p.category)
        const selected = p.id === selectedId
        const units = p.units
          .map((u) => `${u.count && u.count > 1 ? `${u.count}× ` : ''}${u.designation ?? u.type}`)
          .join(', ')
        return (
          <li key={p.id}>
            <button
              type="button"
              data-facility-id={p.id}
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(p.id)}
              onMouseEnter={() => onHover(p.id)}
              onFocus={() => onHover(p.id)}
              className={`flex w-full flex-col gap-1 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-strong ${
                selected
                  ? 'bg-accent-wash ring-1 ring-inset ring-accent-strong'
                  : p.id === hoveredId
                    ? 'bg-surface-3'
                    : 'hover:bg-surface-3'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold"
                  style={{ backgroundColor: group.color, color: categoryInk(p.category) }}
                  title={categoryLabel(p.category)}
                >
                  {categoryCode(p.category)}
                </span>
                <span className="font-medium text-ink">{p.name}</span>
                {p.designation && (
                  <span className="text-xs text-ink-faint">· {p.designation}</span>
                )}
                {sub && (
                  <span className="ml-auto rounded bg-surface-3 px-1.5 py-0.5 text-xs text-ink-muted">
                    {sub}
                  </span>
                )}
              </div>
              <div className="text-sm text-ink-muted">
                <span className="sr-only">{categoryLabel(p.category)} — </span>
                {p.agency.name}
              </div>
              {units && <div className="text-sm text-ink-faint">Units: {units}</div>}
              {p.specialties && p.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-accent-wash px-1.5 py-0.5 text-xs text-accent"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
