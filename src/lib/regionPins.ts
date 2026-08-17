// The registry as points on the global map (docs/05).
//
// A pin needs somewhere to sit, which is why the registry carries `center`
// alongside each entry: the default view plots every published region without
// downloading any of them. An entry with no center — a queued request nobody
// has located yet — simply has no pin, and lives in the About panel's coverage
// list instead.
import type { RegionIndexEntry } from '../types/app'
import { bboxOfPositions, type Position } from './geo'

export interface RegionPin {
  entry: RegionIndexEntry
  center: Position
  /** Facilities in the region, or null where the registry doesn't say. */
  count: number | null
}

/** Every entry that can be put on the map, in registry order. */
export function regionPins(entries: RegionIndexEntry[]): RegionPin[] {
  return entries.flatMap((entry) => {
    const center = entry.center
    if (!center || typeof center[0] !== 'number' || typeof center[1] !== 'number') return []
    return [
      {
        entry,
        center: [center[0], center[1]],
        count: typeof entry.facility_count === 'number' ? entry.facility_count : null,
      },
    ]
  })
}

/** The box that frames every pin, or null when there is nothing to frame. */
export function pinBounds(pins: RegionPin[]): [number, number, number, number] | null {
  return bboxOfPositions(pins.map((pin) => pin.center))
}

/** Total facilities across the pinned regions — the catalog at a glance. */
export function pinnedFacilityCount(pins: RegionPin[]): number {
  return pins.reduce((total, pin) => total + (pin.count ?? 0), 0)
}
