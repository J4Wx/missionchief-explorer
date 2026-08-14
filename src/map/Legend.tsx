// Map legend: color → service group, code badge → category. Only the
// categories present in the current view are listed, so the legend stays short
// on small regions. Identity is carried by the badge text as well as the color.
import { useState } from 'react'
import type { Facility } from '../types/app'
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  GROUP_META,
  GROUP_ORDER,
  categoryCode,
  categoryInk,
} from '../lib/categories'

interface Props {
  /** Facility count per category in the current view. */
  counts: Partial<Record<Facility['category'], number>>
}

export function Legend({ counts }: Props) {
  const [open, setOpen] = useState(true)

  const present = CATEGORY_ORDER.filter((c) => (counts[c] ?? 0) > 0)
  if (present.length === 0) return null

  const groups = GROUP_ORDER.map((group) => ({
    group,
    categories: present.filter((c) => CATEGORY_META[c].group === group),
  })).filter((g) => g.categories.length > 0)

  return (
    <div className="absolute bottom-6 left-3 z-10 max-w-[15rem] rounded-md border border-slate-200 bg-white/95 text-xs shadow-lg backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 font-semibold text-slate-700"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Legend
        <span aria-hidden="true" className="text-slate-400">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto px-3 pb-3">
          {groups.map(({ group, categories }) => (
            <div key={group} className="mb-2 last:mb-0">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-slate-600">
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white"
                  style={{ backgroundColor: GROUP_META[group].color }}
                  aria-hidden="true"
                />
                {GROUP_META[group].label}
              </div>
              <ul className="space-y-1 pl-1">
                {categories.map((c) => (
                  <li key={c} className="flex items-center gap-1.5 text-slate-700">
                    <span
                      className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ring-1 ring-white"
                      style={{
                        backgroundColor: GROUP_META[group].color,
                        color: categoryInk(c),
                      }}
                      aria-hidden="true"
                    >
                      {categoryCode(c)}
                    </span>
                    <span>{CATEGORY_META[c].label}</span>
                    <span className="ml-auto tabular-nums text-slate-500">{counts[c]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
