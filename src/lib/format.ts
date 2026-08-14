// Display helpers for the free-form parts of the schema. `attributes` and unit
// `attributes` are deliberately open objects (category-specific extras), so the
// UI renders whatever keys a record carries rather than hard-coding them.

/** snake_case / kebab-case → "Title Case". */
export function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Renders a JSON attribute value as a short string. */
export function formatValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${humanize(k)}: ${formatValue(v)}`)
      .join(', ')
  }
  return String(value)
}

/** Entries of an open `attributes` object, skipping empties. */
export function attributeEntries(attributes: unknown): [string, unknown][] {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return []
  return Object.entries(attributes as Record<string, unknown>).filter(
    ([, v]) => v != null && v !== '',
  )
}

/** ~5-decimal "lat, lng" — the form people paste into a map search box. */
export function formatCoords([lng, lat]: [number, number]): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}
