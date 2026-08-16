// Three-way theme control: light / system / dark. Three buttons rather than a
// cycling toggle so the current choice — including "follow the OS" — is visible
// without clicking.
//
// A group of `aria-pressed` toggle buttons, not a `radiogroup`: the radiogroup
// pattern owes the user roving tabindex and arrow-key navigation, and a group
// that only half-implements it is worse than one that doesn't claim it. Each
// button is individually tabbable and announces its own pressed state.
import type { ReactNode } from 'react'
import type { ThemePreference } from '../lib/theme'

interface Props {
  value: ThemePreference
  onChange: (preference: ThemePreference) => void
}

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6L14 6M6 14l-1.4 1.4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <>
        <rect
          x="2.5"
          y="4"
          width="15"
          height="10"
          rx="1.5"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M7 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <path
        d="M15.5 11.5A6 6 0 0 1 8.5 4.5a6 6 0 1 0 7 7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    ),
  },
]

export function ThemeToggle({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center rounded-md border border-hairline-strong bg-surface p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={`${option.label} theme`}
            onClick={() => onChange(option.value)}
            className={`rounded p-1 ${
              active
                ? 'bg-accent-strong text-accent-ink'
                : 'text-ink-faint hover:bg-surface-3 hover:text-ink'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              {option.icon}
            </svg>
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
