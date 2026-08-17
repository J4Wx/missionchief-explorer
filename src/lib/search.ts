// Fuzzy search over the visible facilities (docs/05). A Fuse index is built
// once per feature set and reused across keystrokes; an empty query passes the
// set through untouched so the list keeps its name order until you type.
import { useMemo } from 'react'
import Fuse, { type IFuseOptions } from 'fuse.js'
import type { FacilityFeature } from '../types/app'

// Letters that survive NFD because they aren't a base letter plus an accent —
// they need an explicit ASCII reading.
const UNDECOMPOSED: Record<string, string> = {
  ß: 'ss',
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
}

/**
 * Fold a string for matching: lowercase, accents stripped, the letters above
 * spelled out. This is what lets an ASCII keyboard find an accented name —
 * "Munchen" matching "München", "Feuerwehr Loßburg" matching "lossburg" — and it
 * applies to the query and the indexed fields alike so folding never changes
 * which side has to be spelled correctly.
 */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[ßøæœłđðþ]/g, (ch) => UNDECOMPOSED[ch] ?? ch)
}

/** Resolve a dotted Fuse key path ("properties.agency.name") on a feature. */
function resolve(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | null)?.[key], obj)
}

// Weighted toward the name; `ignoreLocation` so a match anywhere in a field
// counts (station names and agencies are long), with a moderate fuzz threshold.
// `getFn` folds every indexed value on the way into the index — Fuse has no
// diacritic handling of its own, so this is the only place it can happen.
const FUSE_OPTIONS: IFuseOptions<FacilityFeature> = {
  threshold: 0.4,
  ignoreLocation: true,
  keys: [
    { name: 'properties.name', weight: 3 },
    { name: 'properties.agency.name', weight: 2 },
    { name: 'properties.designation', weight: 1 },
    { name: 'properties.specialties', weight: 1 },
    { name: 'properties.subtype', weight: 1 },
  ],
  getFn: (feature, path) => {
    const value = resolve(feature, Array.isArray(path) ? path.join('.') : path)
    if (typeof value === 'string') return fold(value)
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string').map(fold)
    }
    return ''
  },
}

/** Features matching `query`, best-first; the input set (name order) if blank. */
export function useSearch(features: FacilityFeature[], query: string): FacilityFeature[] {
  const fuse = useMemo(() => new Fuse(features, FUSE_OPTIONS), [features])
  return useMemo(() => {
    const q = query.trim()
    if (!q) return features
    return fuse.search(fold(q)).map((result) => result.item)
  }, [fuse, features, query])
}
