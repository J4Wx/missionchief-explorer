// Facet filter panel that sits above the results list. Each dimension
// (category / agency / specialty / staffing / status) is a collapsible group of
// toggle rows with live counts; active selections also surface as removable
// chips so the current narrowing is legible at a glance (docs/05).
import { useState } from 'react'
import type { Facility } from '../types/app'
import {
  activeFilterCount,
  type FacetKey,
  type FacetModel,
  type FacetOption,
  type Filters,
} from '../lib/filters'
import { humanize } from '../lib/format'
import { categoryCode, categoryInk, categoryLabel, groupMeta } from '../lib/categories'

interface Props {
  facets: FacetModel
  filters: Filters
  resultCount: number
  totalCount: number
  onToggle: (key: FacetKey, value: string) => void
  onClear: () => void
}

const GROUPS: { key: FacetKey; label: string; note?: string }[] = [
  { key: 'categories', label: 'Category' },
  { key: 'agencies', label: 'Agency' },
  { key: 'specialties', label: 'Specialty' },
  { key: 'staffing', label: 'Staffing' },
  { key: 'statuses', label: 'Status', note: 'Closed and planned are hidden unless selected.' },
]

/** Small colored code badge for a category value (identity ≠ color alone). */
function CategoryBadge({ value }: { value: string }) {
  const category = value as Facility['category']
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[9px] font-bold"
      style={{ backgroundColor: groupMeta(category).color, color: categoryInk(category) }}
    >
      {categoryCode(category)}
    </span>
  )
}

function labelFor(key: FacetKey, value: string): string {
  return key === 'categories' ? categoryLabel(value as Facility['category']) : humanize(value)
}

interface GroupProps {
  label: string
  facetKey: FacetKey
  note?: string
  options: FacetOption[]
  selected: string[]
  onToggle: (value: string) => void
}

function FacetGroup({ label, facetKey, note, options, selected, onToggle }: GroupProps) {
  const [open, setOpen] = useState(selected.length > 0)
  if (options.length === 0) return null

  return (
    <div className="border-t border-hairline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-ink hover:bg-surface-3"
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="rounded-full bg-accent-wash px-1.5 text-xs font-semibold text-accent">
            {selected.length}
          </span>
        )}
        <span aria-hidden="true" className="ml-auto text-ink-faint">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && note && <p className="px-4 pb-1 text-xs text-ink-faint">{note}</p>}
      {open && (
        <ul className="max-h-56 overflow-y-auto px-2 pb-2">
          {options.map((option) => {
            const checked = selected.includes(option.value)
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggle(option.value)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-strong"
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      checked ? 'border-accent-strong bg-accent-strong text-accent-ink' : 'border-hairline-strong'
                    }`}
                  >
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6.5l2.5 2.5 4.5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {facetKey === 'categories' && <CategoryBadge value={option.value} />}
                  <span className="min-w-0 flex-1 truncate text-ink" title={option.label}>
                    {option.label}
                  </span>
                  <span className="tabular-nums text-xs text-ink-faint">{option.count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function FilterPanel({
  facets,
  filters,
  resultCount,
  totalCount,
  onToggle,
  onClear,
}: Props) {
  const active = activeFilterCount(filters)

  // Chips for the selected facet values (search has its own box), in group order.
  const chips = GROUPS.flatMap(({ key }) =>
    filters[key].map((value) => ({ key, value })),
  )

  return (
    <div className="border-b border-hairline bg-surface">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-sm font-semibold text-ink">Filters</span>
        {active > 0 && (
          <span className="rounded-full bg-accent-strong px-1.5 text-xs font-semibold text-accent-ink">
            {active}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-faint">
          {resultCount === totalCount ? `${totalCount}` : `${resultCount} of ${totalCount}`}
        </span>
        {active > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent-wash"
          >
            Clear all
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {chips.map(({ key, value }) => (
            <button
              key={`${key}:${value}`}
              type="button"
              onClick={() => onToggle(key, value)}
              className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-0.5 pl-2 pr-1 text-xs text-ink hover:bg-hairline"
            >
              <span>{labelFor(key, value)}</span>
              <span aria-hidden="true" className="text-ink-faint">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M6 6l8 8M14 6l-8 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="sr-only">Remove {labelFor(key, value)} filter</span>
            </button>
          ))}
        </div>
      )}

      {GROUPS.map(({ key, label, note }) => (
        <FacetGroup
          key={key}
          label={label}
          facetKey={key}
          note={note}
          options={facets[key]}
          selected={filters[key]}
          onToggle={(value) => onToggle(key, value)}
        />
      ))}
    </div>
  )
}
