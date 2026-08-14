// Fuzzy search over the visible facilities (docs/05). A Fuse index is built
// once per feature set and reused across keystrokes; an empty query passes the
// set through untouched so the list keeps its name order until you type.
import { useMemo } from 'react'
import Fuse, { type IFuseOptions } from 'fuse.js'
import type { FacilityFeature } from '../types/app'

// Weighted toward the name; `ignoreLocation` so a match anywhere in a field
// counts (station names and agencies are long), with a moderate fuzz threshold.
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
}

/** Features matching `query`, best-first; the input set (name order) if blank. */
export function useSearch(features: FacilityFeature[], query: string): FacilityFeature[] {
  const fuse = useMemo(() => new Fuse(features, FUSE_OPTIONS), [features])
  return useMemo(() => {
    const q = query.trim()
    if (!q) return features
    return fuse.search(q).map((result) => result.item)
  }, [fuse, features, query])
}
