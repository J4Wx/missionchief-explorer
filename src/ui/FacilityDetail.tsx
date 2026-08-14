// Facility detail panel — everything the schema holds about one record:
// units, specialties, category-specific attributes, the Mission Chief planning
// block, significance, and the sources behind it (docs/05).
import { useEffect, useState, type ReactNode } from 'react'
import type { Facility, FacilityFeature } from '../types/app'
import { categoryInk, categoryLabel, groupMeta } from '../lib/categories'
import { attributeEntries, formatCoords, formatValue, humanize } from '../lib/format'
import { featureCoords } from '../lib/geo'

const STATUS_STYLE: Record<Facility['status'], string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  closed: 'bg-rose-50 text-rose-800 ring-rose-200',
  planned: 'bg-amber-50 text-amber-900 ring-amber-200',
  unknown: 'bg-slate-100 text-slate-700 ring-slate-200',
}

const CONFIDENCE_STYLE: Record<Facility['confidence'], string> = {
  high: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-900 ring-amber-200',
  low: 'bg-rose-50 text-rose-800 ring-rose-200',
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(formatCoords(coords))
      setCopied(true)
    } catch (err) {
      console.error('Clipboard write failed', err)
    }
  }

  const address = [
    p.address.street,
    p.address.city,
    [p.address.state, p.address.postal_code].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')

  const attributes = attributeEntries(p.attributes)
  const group = groupMeta(p.category)

  return (
    <aside
      className="flex h-full flex-col overflow-hidden bg-white"
      aria-label={`Details for ${p.name}`}
    >
      <header className="border-b border-slate-200 px-4 py-3">
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
                <span className="text-xs text-slate-500">{humanize(p.subtype)}</span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[p.status]}`}
              >
                {humanize(p.status)}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900">{p.name}</h2>
            <p className="text-sm text-slate-600">
              {p.agency.name}
              {p.designation && ` · ${p.designation}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        <Section title="Location">
          {address && <p className="text-slate-700">{address}</p>}
          <p className="text-slate-500">
            {[
              p.address.county && `${p.address.county} County`,
              subregionName,
              formatCoords(coords),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyCoords}
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
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
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-1 pr-2 font-medium">Unit</th>
                  <th className="pb-1 pr-2 font-medium">Type</th>
                  <th className="pb-1 pr-2 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {p.units.map((u, i) => {
                  const attrs = attributeEntries(u.attributes)
                  return (
                    <tr key={`${u.type}-${u.designation ?? i}`} className="align-top">
                      <td className="py-1 pr-2 text-slate-800">
                        {u.designation ?? humanize(u.type)}
                        {attrs.length > 0 && (
                          <div className="text-xs text-slate-500">
                            {attrs
                              .map(([k, v]) => `${humanize(k)}: ${formatValue(v)}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-1 pr-2 text-slate-600">{humanize(u.type)}</td>
                      <td className="py-1 pr-2 text-right tabular-nums text-slate-600">
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
                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
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
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {p.game.building_types.map((b) => (
                <span
                  key={b}
                  className="rounded bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white"
                >
                  {b}
                </span>
              ))}
              {p.game.recommended && (
                <span className="rounded bg-white px-1.5 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-300">
                  ★ Recommended build
                </span>
              )}
            </div>
            {p.game.notes && <p className="mt-2 text-blue-900">{p.game.notes}</p>}
          </div>
        </Section>

        {p.significance && (
          <Section title="Significance">
            <p className="text-slate-700">{p.significance}</p>
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
              <span className="text-slate-500">Verified {p.last_verified}</span>
            )}
          </div>
          <ul className="space-y-1">
            {p.sources.map((s) => (
              <li key={s.url} className="break-words">
                <a
                  className="text-blue-700 underline hover:text-blue-900"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {s.title ?? s.url}
                </a>
                {s.retrieved && (
                  <span className="ml-1 text-xs text-slate-500">({s.retrieved})</span>
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
    <section className="border-b border-slate-100 py-3 first:pt-0 last:border-0">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </>
  )
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
    >
      {children} ↗
    </a>
  )
}
