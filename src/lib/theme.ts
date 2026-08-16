// Theme preference ⇄ the `data-theme` attribute on <html>.
//
// The preference is three-valued (light / dark / system); what the page renders
// is the *resolved* two-valued theme. `index.html` runs the same resolution
// inline before first paint so there is no flash of the wrong theme; this
// module keeps it in sync afterwards and is the single writer of the attribute.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/** Shared with the inline boot script in index.html — keep the two in step. */
export const THEME_STORAGE_KEY = 'dispatch-atlas:theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** Stored preference, or `system` when unset/unreadable (e.g. blocked storage). */
export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isPreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference
}

function subscribeToSystem(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

/**
 * The active theme plus a setter that persists the choice. `system` keeps
 * following the OS after the fact, so a preference set once still tracks a
 * later OS switch.
 */
export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). The choice
      // still applies to this session; it just won't survive a reload.
    }
  }, [])

  // The OS setting is external state, so it is subscribed to rather than
  // mirrored into a state variable — `resolved` then stays a pure derivation.
  const system = useSyncExternalStore(subscribeToSystem, systemTheme, () => 'light' as const)
  const resolved: ResolvedTheme = preference === 'system' ? system : preference

  // `color-scheme` follows too, so form controls, scrollbars and the canvas
  // backdrop match the theme without per-element styling.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.style.colorScheme = resolved
  }, [resolved])

  return { preference, resolved, setPreference }
}
