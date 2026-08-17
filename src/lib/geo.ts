// Small geometry helpers. The schema types coordinates as a 2-tuple of unknown
// (JSON Schema can't express "number pair" in a way the generator narrows), so
// reading a position is centralized here rather than cast at every call site.
import type { FacilityFeature } from '../types/app'

export type Position = [number, number]

/** [lng, lat] of a facility feature. */
export function featureCoords(feature: FacilityFeature): Position {
  const [lng, lat] = feature.geometry.coordinates
  return [Number(lng), Number(lat)]
}

/** Reads a schema `[unknown, unknown]` center as [lng, lat]. */
export function toPosition(value: [unknown, unknown] | undefined): Position | null {
  if (!value) return null
  const [lng, lat] = value
  if (typeof lng !== 'number' || typeof lat !== 'number') return null
  return [lng, lat]
}

/** [west, south, east, north] covering every position, or null if there are none. */
export function bboxOfPositions(
  positions: Position[],
): [number, number, number, number] | null {
  if (positions.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lng, lat] of positions) {
    if (lng < west) west = lng
    if (lng > east) east = lng
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return [west, south, east, north]
}

/** [west, south, east, north] covering every feature, or null if there are none. */
export function bboxOf(features: FacilityFeature[]): [number, number, number, number] | null {
  return bboxOfPositions(features.map(featureCoords))
}
