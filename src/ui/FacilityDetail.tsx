// Facility detail panel — everything the schema holds about one record:
// units, specialties, category-specific attributes, the Mission Chief planning
// block, significance, and the sources behind it (docs/05).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Facility, FacilityFeature } from '../types/app'
import { addressLines, countyLabel } from '../lib/address'
import { categoryInk, categoryLabel, groupMeta } from '../lib/categories'
import { attributeEntries, formatCoords, formatValue, humanize } from '../lib/format'
import { featureCoords } from '../lib/geo'

// Status and confidence are *state*, not series identity, so they keep their
// own reserved good/caution/bad hues rather than borrowing a group color — and
// each is always paired with its label, never carried by color alone.
const GOOD = 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-800'
const CAUTION = 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-800'
const BAD = 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-800'
const NEUTRAL = 'bg-surface-3 text-ink ring-hairline'

const STATUS_STYLE: Record<Facility['status'], string> = {
  active: GOOD,
  closed: BAD,
  planned: CAUTION,
  unknown: NEUTRAL,
}

const CONFIDENCE_STYLE: Record<Facility['confidence'], string> = {
  high: GOOD,
  medium: CAUTION,
  low: BAD,
}

interface Props {
  feature: FacilityFeature
  subregionName: string | null
  onClose: () => void
}

export function FacilityDetail({ feature, subregionName, onClose }: Props) {
  const p = feature.properties
  const coords = featureCoords(feature)
  const [copied, setCopied] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // On narrow screens this panel covers the whole viewport, so leaving focus
  // behind it would strand keyboard users. Move focus in on open and hand it
  // back to whatever opened it (a list row, a marker) on close.
  useEffect(() => {
    const opener = document.activeElement
    panelRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [])

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(formatCoords(coords))
      setCopied(true)
    } catch (err) {
      console.error('Clipboard write failed', err)
    }
  }

  // Ordered per the address's own country, not US-first (src/lib/address.ts).
  const address = addressLines(p.address)

  const attributes = attributeEntries(p.attributes)
  const group = groupMeta(p.category)

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      className="flex h-full flex-col overflow-hidden bg-surface focus:outline-none"
      aria-label={`Details for ${p.name}`}
    >
      <header className="border-b border-hairline px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span
                className="rounded px-1.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: group.color, color: categoryInk(p.category) }}
              >
                {categoryLabel(p.category)}
              </span>
              {p.subtype && (
                <span className="text-xs text-ink-faint">{humanize(p.subtype)}</span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[p.status]}`}
              >
                {humanize(p.status)}
              </span>
            </div>
            <h2 className="text-base font-bold text-ink">{p.name}</h2>
            <p className="text-sm text-ink-muted">
              {p.agency.name}
              {p.designation && ` · ${p.designation}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-faint hover:bg-surface-3 hover:text-ink"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        <Section title="Location">
          {address.length > 0 && (
            <p className="text-ink">
              {address.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </p>
          )}
          <p className="text-ink-faint">
            {[countyLabel(p.address), subregionName, formatCoords(coords)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyCoords}
              className="rounded border border-hairline-strong px-2 py-1 text-xs text-ink hover:bg-surface-3"
            >
              {copied ? 'Copied ✓' : 'Copy coordinates'}
            </button>
            <ExternalLink
              href={`https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[0]}#map=18/${coords[1]}/${coords[0]}`}
            >
              OpenStreetMap
            </ExternalLink>
            <ExternalLink
              href={`https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`}
            >
              Google Maps
            </ExternalLink>
          </div>
        </Section>

        {(p.staffing_model || p.operating_hours || p.agency.level) && (
          <Section title="Operations">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {p.agency.level && <Row label="Agency level" value={humanize(p.agency.level)} />}
              {p.staffing_model && (
                <Row label="Staffing" value={humanize(p.staffing_model)} />
              )}
              {p.operating_hours && (
                <Row
                  label="Hours"
                  value={p.operating_hours === '24_7' ? '24/7' : humanize(p.operating_hours)}
                />
              )}
            </dl>
          </Section>
        )}

        {p.units.length > 0 && (
          <Section title={`Units & apparatus (${p.units.length})`}>
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-ink-faint">
                  <th className="pb-1 pr-2 font-medium">Unit</th>
                  <th className="pb-1 pr-2 font-medium">Type</th>
                  <th className="pb-1 pr-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {p.units.map((u, i) => {
                  const attrs = attributeEntries(u.attributes)
                  return (
                    <tr key={`${u.type}-${u.designation ?? i}`} className="align-top">
                      <td className="py-1 pr-2 text-ink">
                        {u.designation ?? humanize(u.type)}
                        {attrs.length > 0 && (
                          <div className="text-xs text-ink-faint">
                            {attrs
                              .map(([k, v]) => `${humanize(k)}: ${formatValue(v)}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-ink-muted">{humanize(u.type)}</td>
                      <td className="py-1 pr-2 text-right tabular-nums text-ink-muted">
                        {u.count ?? 1}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Section>
        )}

        {p.specialties && p.specialties.length > 0 && (
          <Section title="Specialties">
            <div className="flex flex-wrap gap-1">
              {p.specialties.map((s) => (
                <span
                  key={s}
                  className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-ink"
                >
                  {humanize(s)}
                </span>
              ))}
            </div>
          </Section>
        )}

        {attributes.length > 0 && (
          <Section title="Attributes">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {attributes.map(([k, v]) => (
                <Row key={k} label={humanize(k)} value={formatValue(v)} />
              ))}
            </dl>
          </Section>
        )}

        <Section title="Mission Chief">
          <div className="rounded-md border border-accent/30 bg-accent-wash p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {p.game.building_types.map((b) => (
                <span
                  key={b}
                  className="rounded bg-accent-strong px-1.5 py-0.5 text-xs font-semibold text-accent-ink"
                >
                  {b}
                </span>
              ))}
              {p.game.recommended && (
                <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/40">
                  ★ Recommended build
                </span>
              )}
            </div>
            {p.game.notes && <p className="mt-2 text-ink">{p.game.notes}</p>}
          </div>
        </Section>

        {p.significance && (
          <Section title="Significance">
            <p className="text-ink">{p.significance}</p>
          </Section>
        )}

        <Section title="Sources">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`rounded px-1.5 py-0.5 font-medium ring-1 ring-inset ${CONFIDENCE_STYLE[p.confidence]}`}
            >
              {humanize(p.confidence)} confidence
            </span>
            {p.last_verified && (
              <span className="text-ink-faint">Verified {p.last_verified}</span>
            )}
          </div>
          <ul className="space-y-1">
            {p.sources.map((s) => (
              <li key={s.url} className="break-words">
                <a
                  className="text-accent underline hover:text-ink"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {s.title ?? s.url}
                </a>
                {s.retrieved && (
                  <span className="ml-1 text-xs text-ink-faint">({s.retrieved})</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
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
