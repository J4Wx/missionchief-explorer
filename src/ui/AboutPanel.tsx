// About / data-provenance dialog (docs/05).
//
// Everything a player needs to judge how far to trust what they're looking at:
// where the records come from, what the confidence grades mean, which regions
// exist and in what state, and how to request or correct one. Deep-linkable via
// `?about=1` so it can be shared as an answer to "where is this data from?".
import { useEffect, useRef, type ReactNode } from 'react'
import type { Facility, RegionFeatureCollection, RegionIndexEntry } from '../types/app'
import {
  CORRECTION_TEMPLATE,
  REGION_REQUEST_TEMPLATE,
  REPO_URL,
  issueUrl,
  reviewUrl,
} from '../lib/links'
import { ageInDays, formatReviewAge, todayIso } from '../lib/staleness'

interface Props {
  regions: RegionIndexEntry[]
  /** The region currently open, for its own provenance block. Null while loading. */
  region: RegionFeatureCollection | null
  onClose: () => void
}

const STATUS_LABEL: Record<RegionIndexEntry['status'], string> = {
  published: 'Published',
  in_progress: 'In progress',
  requested: 'Requested',
}

const STATUS_STYLE: Record<RegionIndexEntry['status'], string> = {
  published:
    'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800',
  in_progress:
    'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800',
  requested: 'bg-surface-3 text-ink-muted ring-hairline',
}

const CONFIDENCE_BLURB: Record<Facility['confidence'], string> = {
  high: 'official or open-government sources',
  medium: 'reputable secondary sources',
  low: 'sparse or unverified sources — treat as a lead, not a fact',
}

/** Host of a source URL, for the "who did this region cite" summary. */
function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function AboutPanel({ regions, region, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const opener = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [])

  const meta = region?.metadata
  const features = region?.features ?? []
  const today = todayIso()

  const byConfidence = features.reduce<Partial<Record<Facility['confidence'], number>>>(
    (acc, f) => {
      const c = f.properties.confidence
      acc[c] = (acc[c] ?? 0) + 1
      return acc
    },
    {},
  )

  const hosts = [
    ...new Set(
      features.flatMap((f) => f.properties.sources.map((s) => sourceHost(s.url)).filter(Boolean)),
    ),
  ].sort() as string[]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
      {/* Backdrop click closes; the panel stops the event from reaching it. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl rounded-lg border border-hairline bg-surface shadow-xl focus:outline-none"
      >
        <header className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="about-title" className="text-lg font-bold text-ink">
              About Dispatch Atlas
            </h2>
            <p className="text-sm text-ink-muted">
              Where this data comes from, and how far to trust it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close about"
            className="rounded p-1 text-ink-faint hover:bg-surface-3 hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm">
          <Section title="What this is">
            <p className="text-ink-muted">
              A map-first catalog of real-world emergency-services facilities — fire and
              rescue, EMS, police at every level, hospitals, prisons, sea and mountain
              rescue, tow operators and control rooms — assembled to help players plan
              builds and coverage in the dispatch game <em>Mission Chief</em>. Each region
              is recorded the way its own country organizes those services, so a UK region
              reads in fire-and-rescue services and major trauma centres rather than being
              flattened into American equivalents. It is an unofficial fan project with no
              affiliation to the game or its publisher, and it describes the real world, not
              the game world.
            </p>
          </Section>

          <Section title="Where the data comes from">
            <p className="text-ink-muted">
              Each region is researched and generated by an AI agent following a written
              contract, then reviewed and merged as a pull request. OpenStreetMap (via the
              Overpass API) provides discovery — the locations and names — and each record
              is then enriched from official agency sites, government open-data portals and
              Wikipedia/Wikidata. OpenStreetMap is treated as a starting point, never as
              ground truth for apparatus rosters or capabilities.
            </p>
            <p className="mt-2 text-ink-muted">
              <strong className="font-semibold text-ink">Nothing is invented.</strong> Every
              record cites at least one resolvable source; anything that could not be found
              is recorded as unknown rather than guessed. Only public information is
              included — no personal data, and no operationally sensitive security detail.
            </p>
          </Section>

          <Section title="How to read confidence">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {(['high', 'medium', 'low'] as const).map((level) => (
                <div key={level} className="contents">
                  <dt className="font-medium text-ink">{level}</dt>
                  <dd className="text-ink-muted">{CONFIDENCE_BLURB[level]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-ink-muted">
              Every facility panel lists its own sources and a{' '}
              <em>last verified</em> date. Details change — stations close, apparatus moves,
              trauma designations are renewed — so treat an old verification date as a
              prompt to check the source yourself.
            </p>
          </Section>

          <Section title="Coverage">
            <p className="mb-2 text-ink-muted">
              A published region is a first pass, not a finished one. Any of them can be
              sent back for a deeper look — rosters, specialties, anything that has changed
              since. Nothing is re-run automatically; a region is revisited because someone
              asked.
            </p>
            <ul className="space-y-2">
              {regions.map((entry) => (
                <li key={entry.region_id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink">{entry.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[entry.status]}`}
                  >
                    {STATUS_LABEL[entry.status]}
                  </span>
                  <code className="text-xs text-ink-faint">{entry.region_id}</code>
                  {entry.status === 'published' && (
                    <>
                      <span className="text-xs text-ink-faint">
                        {formatReviewAge(ageInDays(entry.last_reviewed, today))}
                      </span>
                      <a
                        href={reviewUrl(entry.region_id, entry.name)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="ml-auto shrink-0 text-xs text-accent underline hover:text-ink"
                      >
                        Request a review ↗
                      </a>
                    </>
                  )}
                  {entry.note && (
                    <p className="w-full text-xs text-ink-faint">{entry.note}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          {meta && (
            <Section title={`Provenance — ${meta.name}`}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <Row label="Facilities" value={`${features.length}`} />
                <Row
                  label="Confidence"
                  value={
                    (['high', 'medium', 'low'] as const)
                      .filter((c) => byConfidence[c])
                      .map((c) => `${byConfidence[c]} ${c}`)
                      .join(' · ') || '—'
                  }
                />
                {meta.generated_by && (
                  <Row
                    label="Generated by"
                    value={meta.generated_by === 'agent' ? 'AI agent (reviewed)' : 'Human'}
                  />
                )}
                {meta.generated_at && <Row label="Generated" value={meta.generated_at} />}
                <Row
                  label="Reviewed"
                  value={
                    meta.last_reviewed
                      ? `${meta.last_reviewed} — ${formatReviewAge(ageInDays(meta.last_reviewed, today))}`
                      : 'no whole-region pass recorded'
                  }
                />
                <Row label="Distinct sources" value={`${hosts.length} domains`} />
              </dl>
              {hosts.length > 0 && (
                <p className="mt-2 break-words text-xs text-ink-faint">{hosts.join(', ')}</p>
              )}
              {/* Declared gaps (docs/03) — what this region is known *not* to
                  carry, so a blank space isn't read as "there is nothing here". */}
              {meta.coverage?.gaps && meta.coverage.gaps.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-ink">Known gaps in this region</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-muted">
                    {meta.coverage.gaps.map((gap) => (
                      <li key={gap.what}>
                        {gap.what}
                        {gap.count !== undefined && ` (${gap.count})`} — {gap.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {meta.coverage?.note && (
                <p className="mt-2 text-xs text-ink-faint">{meta.coverage.note}</p>
              )}
            </Section>
          )}

          <Section title="Request a region, or fix one">
            <p className="text-ink-muted">
              Missing your city? Ask for it, and it gets queued in the region registry for
              the generation agent to pick up. Spotted something wrong — a closed station, a
              missing engine, a bad trauma level? Corrections are welcome as issues or pull
              requests; a citation is all that's needed, and every facility panel has its
              own prefilled correction link.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ExternalLink href={issueUrl(REGION_REQUEST_TEMPLATE)}>
                Request a region
              </ExternalLink>
              <ExternalLink href={issueUrl(CORRECTION_TEMPLATE)}>
                Report a correction
              </ExternalLink>
              {meta && (
                <ExternalLink href={reviewUrl(meta.region_id, meta.name)}>
                  Request a review of {meta.name}
                </ExternalLink>
              )}
              <ExternalLink href={`${REPO_URL}/blob/main/CONTRIBUTING.md`}>
                Contribution guide
              </ExternalLink>
              <ExternalLink href={REPO_URL}>Source code</ExternalLink>
            </div>
          </Section>

          <Section title="Credits">
            <p className="text-ink-muted">
              Facility discovery from{' '}
              <InlineLink href="https://www.openstreetmap.org/copyright">
                OpenStreetMap
              </InlineLink>{' '}
              contributors (ODbL). Basemap tiles by{' '}
              <InlineLink href="https://openfreemap.org/">OpenFreeMap</InlineLink>, rendered
              with <InlineLink href="https://maplibre.org/">MapLibre GL</InlineLink>. Region
              records carry their own per-facility source citations.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-hairline py-3 first:pt-0 last:border-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </>
  )
}

function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-accent underline hover:text-ink"
    >
      {children}
    </a>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded border border-hairline-strong px-2 py-1 text-xs text-ink hover:bg-surface-3"
    >
      {children} ↗
    </a>
  )
}
