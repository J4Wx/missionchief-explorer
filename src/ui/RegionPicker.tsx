// Region picker (docs/05): a searchable, nested listbox over the registry.
//
// A native <select> can't nest past one level of <optgroup> and can't be
// searched, so this is the ARIA combobox pattern instead — a trigger showing
// the current region, and a popover holding a filter box over the
// country → division → region tree from lib/regionTree.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { RegionIndexEntry } from '../types/app'
import {
  buildRegionTree,
  filterRegionTree,
  flattenRegions,
  type RegionLeaf,
  type RegionNode,
} from '../lib/regionTree'

interface Props {
  regions: RegionIndexEntry[]
  value: string
  onChange: (regionId: string) => void
}

/** Indent per level, in px — headers and their regions share the same ramp. */
const INDENT = 12

export function RegionPicker({ regions, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Which option the keyboard is on; only meaningful while open.
  const [activeId, setActiveId] = useState(value)

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const baseId = useId()
  const listId = `${baseId}-list`
  const optionId = (regionId: string) => `${baseId}-${regionId}`

  const tree = useMemo(() => buildRegionTree(regions), [regions])
  const filtered = useMemo(() => filterRegionTree(tree, query), [tree, query])
  const options = useMemo(() => flattenRegions(filtered), [filtered])

  const selected = useMemo(
    () => flattenRegions(tree).find((leaf) => leaf.entry.region_id === value) ?? null,
    [tree, value],
  )

  // Filtering can drop the active option out from under the keyboard; fall
  // back to the first thing still on screen.
  const active =
    options.find((leaf) => leaf.entry.region_id === activeId) ?? options[0] ?? null

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const choose = useCallback(
    (leaf: RegionLeaf) => {
      onChange(leaf.entry.region_id)
      setOpen(false)
      triggerRef.current?.focus()
    },
    [onChange],
  )

  // Opening starts from the current region with an empty filter.
  const openPicker = useCallback(() => {
    setQuery('')
    setActiveId(value)
    setOpen(true)
  }, [value])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Keep the active option in view as the keyboard walks past the fold.
  useEffect(() => {
    if (!open || !active) return
    listRef.current
      ?.querySelector(`#${CSS.escape(`${baseId}-${active.entry.region_id}`)}`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, active, baseId])

  // A click anywhere else dismisses the popover, like a native select.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const move = (delta: number) => {
    if (options.length === 0) return
    const from = active ? options.indexOf(active) : -1
    const next = Math.min(Math.max(from + delta, 0), options.length - 1)
    setActiveId(options[next].entry.region_id)
  }

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        move(-options.length)
        break
      case 'End':
        e.preventDefault()
        move(options.length)
        break
      case 'Enter':
        e.preventDefault()
        if (active) choose(active)
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      openPicker()
    }
  }

  const renderNodes = (nodes: RegionNode[], depth: number): ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'region') {
        const id = node.entry.region_id
        return (
          <div
            key={id}
            id={optionId(id)}
            role="option"
            aria-selected={id === value}
            onClick={() => choose(node)}
            onMouseMove={() => setActiveId(id)}
            style={{ paddingLeft: 8 + depth * INDENT }}
            className={`flex cursor-pointer items-center gap-2 py-1.5 pr-2 text-sm ${
              active?.entry.region_id === id ? 'bg-accent-wash' : ''
            }`}
          >
            <span className={`truncate ${id === value ? 'font-medium text-ink' : 'text-ink'}`}>
              {node.entry.name}
            </span>
            {id === value && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="ml-auto shrink-0 text-accent"
              >
                <path
                  d="M4 10.5l4 4 8-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )
      }

      return (
        <div key={node.id} role="group" aria-label={node.label}>
          <div
            aria-hidden="true"
            style={{ paddingLeft: 8 + depth * INDENT }}
            className="flex items-center gap-2 pr-2 pb-0.5 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"
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

  const path = selected ? [...selected.path.map((c) => c.label), selected.entry.name] : []

  return (
    <div ref={containerRef} className="relative flex items-center gap-2 text-sm">
      <span id={`${baseId}-label`} className="font-medium text-ink-muted">
        Region
      </span>
      {/* Width capped so a long region name can't stretch the header onto a
          second row; the full path is on the button's accessible name. */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected ? `Region: ${path.join(' › ')}` : 'Select a region'}
        title={path.join(' › ')}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={onTriggerKeyDown}
        className="flex max-w-52 items-center gap-1.5 rounded-md border border-hairline-strong bg-surface px-2 py-1 text-ink shadow-sm hover:bg-surface-3 focus:border-accent-strong"
      >
        {selected && (
          <span className="shrink-0 rounded bg-surface-3 px-1 text-xs font-medium text-ink-muted">
            {selected.path[0]?.code ?? selected.entry.country}
          </span>
        )}
        <span className="truncate">{selected ? selected.entry.name : 'Select a region'}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-ink-faint"
        >
          <path
            d="M5 7.5l5 5 5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-md border border-hairline-strong bg-surface shadow-lg">
          <div className="border-b border-hairline p-2">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-labelledby={`${baseId}-label`}
              aria-activedescendant={active ? optionId(active.entry.region_id) : undefined}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Filter regions…"
              autoComplete="off"
              className="w-full rounded border border-hairline-strong bg-surface px-2 py-1 text-sm text-ink focus:border-accent-strong focus:outline-none"
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Regions"
            className="max-h-72 overflow-y-auto py-1"
          >
            {options.length > 0 ? (
              renderNodes(filtered, 0)
            ) : (
              <p className="px-3 py-2 text-sm text-ink-faint">No regions match “{query}”.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
