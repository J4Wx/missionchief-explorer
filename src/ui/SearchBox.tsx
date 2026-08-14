// Free-text search box for the top bar. Controlled by App so its value
// round-trips through the URL; clears to empty via the × button or Escape.
import type { KeyboardEvent } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function SearchBox({ value, onChange }: Props) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault()
      onChange('')
    }
  }

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-slate-400"
      >
        {/* magnifying glass */}
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
          <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search facilities…"
        aria-label="Search facilities"
        className="w-44 rounded-md border border-slate-300 bg-white py-1 pl-7 pr-7 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none sm:w-56"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute inset-y-0 right-1 flex items-center px-1 text-slate-400 hover:text-slate-600"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M6 6l8 8M14 6l-8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
