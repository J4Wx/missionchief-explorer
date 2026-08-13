// Loads the region registry and region GeoJSON files. Data lives in /data
// (the single source of truth) and is pulled in via import.meta.glob so it is
// bundled at build time; region files load lazily, one at a time.
import type { RegionFeatureCollection, RegionIndex } from '../types/app'

// index.json is small — load it eagerly. (?raw keeps parsing explicit/consistent.)
const indexModules = import.meta.glob('/data/regions/index.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// Region files load on demand.
const regionModules = import.meta.glob('/data/regions/*.geojson', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

export function loadIndex(): RegionIndex {
  const raw = Object.values(indexModules)[0]
  if (!raw) throw new Error('data/regions/index.json not found')
  return JSON.parse(raw) as RegionIndex
}

export async function loadRegion(file: string): Promise<RegionFeatureCollection> {
  const loader = regionModules[`/data/regions/${file}`]
  if (!loader) throw new Error(`Region file not found: ${file}`)
  return JSON.parse(await loader()) as RegionFeatureCollection
}
