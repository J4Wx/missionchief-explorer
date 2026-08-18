// How long each region has gone without a whole-region pass (docs/07 Phase 8).
//
// The registry carries `last_reviewed` alongside the map pin, so this ranks the
// whole catalog without downloading a single region file — the same bargain
// `center` and `facility_count` make, and the reason the app can offer "these
// could use a look" on the landing view.
//
// Read it as an invitation, not a warning. An old review date doesn't make a
// record wrong; it means nobody has been back since, which is a suggestion for
// where the next depth pass would pay off. Nothing here hides a region, sorts it
// out of the map, or marks it untrustworthy.
import type { RegionIndexEntry } from '../types/app'

export interface RegionReview {
  entry: RegionIndexEntry
  /** ISO date of the last whole-region pass, or null if none was ever recorded. */
  lastReviewed: string | null
  /** Whole days since that pass, or null when there is no date to measure from. */
  ageDays: number | null
}

/** Today as an ISO date — the app's clock, injectable so tests don't have one. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Whole days between two ISO dates, or null if either is missing or unparseable. */
export function ageInDays(date: string | null | undefined, asOf: string): number | null {
  if (!date) return null
  const from = Date.parse(`${date}T00:00:00Z`)
  const to = Date.parse(`${asOf}T00:00:00Z`)
  if (Number.isNaN(from) || Number.isNaN(to)) return null
  return Math.round((to - from) / 86_400_000)
}

/**
 * Published regions, longest-unreviewed first. A region that has never recorded
 * a review sorts ahead of every dated one: not knowing when it was last worked
 * is the strongest case for working it, not a reason to skip it.
 */
export function reviewsByAge(entries: RegionIndexEntry[], asOf: string): RegionReview[] {
  return entries
    .filter((entry) => entry.status === 'published')
    .map((entry) => ({
      entry,
      lastReviewed: entry.last_reviewed ?? null,
      ageDays: ageInDays(entry.last_reviewed, asOf),
    }))
    .sort((a, b) => {
      if (a.lastReviewed === b.lastReviewed) {
        return a.entry.region_id.localeCompare(b.entry.region_id)
      }
      if (!a.lastReviewed) return -1
      if (!b.lastReviewed) return 1
      return a.lastReviewed.localeCompare(b.lastReviewed)
    })
}

/** The few oldest, for the landing view's suggestion list. */
export function stalestRegions(
  entries: RegionIndexEntry[],
  asOf: string,
  limit = 3,
): RegionReview[] {
  return reviewsByAge(entries, asOf).slice(0, limit)
}

/** "never reviewed" / "reviewed today" / "reviewed 5 months ago". */
export function formatReviewAge(days: number | null): string {
  if (days === null) return 'never reviewed'
  if (days <= 0) return 'reviewed today'
  if (days === 1) return 'reviewed yesterday'
  if (days < 45) return `reviewed ${days} days ago`
  // Average month, not 30 — over half a year the difference is a whole month.
  const months = Math.round(days / 30.44)
  if (months < 24) return `reviewed ${months} months ago`
  return `reviewed ${Math.round(days / 365)} years ago`
}
