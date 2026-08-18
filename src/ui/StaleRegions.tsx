// "Could use a look" — the regions nobody has worked in the longest, offered on
// the landing view as a suggestion for where the next depth pass would pay off
// (docs/07 Phase 8).
//
// Framing matters here. This is an invitation to contribute, not a warning about
// the data: an old review date says nobody has been back, not that anything is
// wrong. Every region — listed here or not — can be sent for review from the
// About panel, so this list is a shortcut, never the only way in.
import type { RegionIndexEntry } from '../types/app'
import { reviewUrl } from '../lib/links'
import { formatReviewAge, stalestRegions, todayIso } from '../lib/staleness'

interface Props {
  regions: RegionIndexEntry[]
  onSelect: (regionId: string) => void
  /** ISO date to measure ages against; injectable so tests aren't time-dependent. */
  asOf?: string
  limit?: number
}

export function StaleRegions({ regions, onSelect, asOf = todayIso(), limit = 3 }: Props) {
  const stale = stalestRegions(regions, asOf, limit)
  // Below three published regions the ranking says nothing useful — it would
  // just be the whole catalog under a heading implying something is wrong.
  if (stale.length < 3) return null

  return (
    <section aria-labelledby="stale-regions-heading" className="border-t border-hairline px-4 py-3">
      <h2
        id="stale-regions-heading"
        className="text-xs font-semibold uppercase tracking-wide text-ink-faint"
      >
        Could use a look
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Longest since anyone worked the whole region. Nothing here is known to be wrong —
        a region is only ever revisited because someone asks, so this is where asking helps
        most.
      </p>
      <ul className="mt-2 space-y-1">
        {stale.map(({ entry, ageDays }) => (
          <li key={entry.region_id} className="flex flex-wrap items-baseline gap-x-2">
            <button
              type="button"
              onClick={() => onSelect(entry.region_id)}
              className="rounded text-left text-sm font-medium text-ink hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong"
            >
              {entry.name}
            </button>
            <span className="text-xs text-ink-faint">{formatReviewAge(ageDays)}</span>
            <a
              href={reviewUrl(entry.region_id, entry.name)}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-auto shrink-0 text-xs text-accent underline hover:text-ink"
            >
              Request a review ↗
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
