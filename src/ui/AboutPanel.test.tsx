// Covers only what Phase 8 put in the About panel: review age, a review request
// on every published region, and the declared gaps of the region being viewed.
// The rest of the panel is prose.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AboutPanel } from './AboutPanel'
import { feature, regionEntry } from '../test/fixtures'
import type { RegionFeatureCollection } from '../types/app'

const REGIONS = [
  regionEntry({ region_id: 'us-ga-savannah', name: 'Savannah', last_reviewed: '2026-08-14' }),
  regionEntry({ region_id: 'us-sc-charleston', name: 'Charleston', last_reviewed: '2026-08-16' }),
  regionEntry({ region_id: 'us-tx-austin', name: 'Austin', status: 'requested' }),
]

const region = (metadata: Partial<RegionFeatureCollection['metadata']> = {}) =>
  ({
    type: 'FeatureCollection',
    metadata: {
      region_id: 'us-sc-charleston',
      name: 'Charleston',
      country: 'US',
      center: [-79.95, 32.85],
      zoom: 11,
      generated_by: 'agent',
      generated_at: '2026-08-16',
      last_reviewed: '2026-08-16',
      schema_version: 2,
      ...metadata,
    },
    features: [feature()],
  }) as RegionFeatureCollection

const renderPanel = (regionFile: RegionFeatureCollection | null = null) =>
  render(<AboutPanel regions={REGIONS} region={regionFile} onClose={vi.fn()} />)

describe('AboutPanel', () => {
  it('offers a review request for every published region, however fresh', () => {
    renderPanel()
    const links = screen.getAllByRole('link', { name: /request a review ↗/i })
    const regionsAsked = links.map((link) =>
      new URL(link.getAttribute('href') ?? '').searchParams.get('region'),
    )
    expect(regionsAsked).toEqual(['us-ga-savannah', 'us-sc-charleston'])
  })

  it('does not offer to review a region that has not been generated yet', () => {
    renderPanel()
    const links = screen.getAllByRole('link', { name: /request a review ↗/i })
    const hrefs = links.map((link) => link.getAttribute('href') ?? '')
    expect(hrefs.some((href) => href.includes('us-tx-austin'))).toBe(false)
  })

  it('shows when the open region was last worked as a whole', () => {
    renderPanel(region())
    expect(screen.getByText(/2026-08-16 — reviewed/)).toBeInTheDocument()
  })

  it('says so plainly when no whole-region pass was ever recorded', () => {
    renderPanel(region({ last_reviewed: undefined }))
    expect(screen.getByText('no whole-region pass recorded')).toBeInTheDocument()
  })

  it("lists the region's declared gaps, so a blank space isn't read as absence", () => {
    renderPanel(
      region({
        coverage: {
          searched: ['tow'],
          gaps: [
            { what: 'tow operators', reason: 'no public addresses' },
            { what: 'unplaced departments', reason: 'no geocodable address', count: 5 },
          ],
        },
      }),
    )
    expect(screen.getByText('Known gaps in this region')).toBeInTheDocument()
    expect(screen.getByText(/tow operators — no public addresses/)).toBeInTheDocument()
    expect(
      screen.getByText(/unplaced departments \(5\) — no geocodable address/),
    ).toBeInTheDocument()
  })

  it('shows no gap list for a region that has declared none', () => {
    renderPanel(region())
    expect(screen.queryByText('Known gaps in this region')).not.toBeInTheDocument()
  })

  it('keeps the coverage list readable when a region has no note', () => {
    renderPanel()
    const coverage = screen.getByText('Savannah').closest('li')
    expect(within(coverage as HTMLElement).getByText(/reviewed/)).toBeInTheDocument()
  })
})
