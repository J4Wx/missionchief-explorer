import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StaleRegions } from './StaleRegions'
import { regionEntry } from '../test/fixtures'

const AS_OF = '2026-08-18'

const REGIONS = [
  regionEntry({ region_id: 'us-ga-savannah', name: 'Savannah', last_reviewed: '2026-01-04' }),
  regionEntry({ region_id: 'us-sc-charleston', name: 'Charleston', last_reviewed: '2026-08-16' }),
  regionEntry({ region_id: 'gb-mersey-liverpool', name: 'Liverpool', last_reviewed: '2026-06-01' }),
  regionEntry({ region_id: 'us-ny-buffalo', name: 'Buffalo', last_reviewed: '2026-08-17' }),
]

function renderList(regions = REGIONS, props = {}) {
  const onSelect = vi.fn()
  render(<StaleRegions regions={regions} onSelect={onSelect} asOf={AS_OF} {...props} />)
  return { onSelect }
}

describe('StaleRegions', () => {
  it('lists the longest-unreviewed regions, oldest first', () => {
    renderList()
    const names = screen.getAllByRole('button').map((b) => b.textContent)
    expect(names).toEqual(['Savannah', 'Liverpool', 'Charleston'])
  })

  it('says how long it has been, in plain language', () => {
    renderList()
    expect(screen.getByText('reviewed 7 months ago')).toBeInTheDocument() // Savannah, 226 days
    expect(screen.getByText('reviewed 2 days ago')).toBeInTheDocument()
  })

  it('offers a prefilled review request per region', () => {
    renderList()
    const link = screen.getAllByRole('link', { name: /request a review/i })[0]
    expect(link).toHaveAttribute('target', '_blank')
    const url = new URL(link.getAttribute('href') ?? '')
    expect(url.searchParams.get('template')).toBe('06-region-review.yml')
    expect(url.searchParams.get('region')).toBe('us-ga-savannah')
  })

  it('opens a region when its name is clicked', async () => {
    const { onSelect } = renderList()
    await userEvent.click(screen.getByRole('button', { name: 'Savannah' }))
    expect(onSelect).toHaveBeenCalledWith('us-ga-savannah')
  })

  it('says nothing at all when there are too few regions to rank', () => {
    // With two published regions the "oldest" is half the catalog — a ranking
    // that implies something without meaning anything.
    const { container } = render(
      <StaleRegions regions={REGIONS.slice(0, 2)} onSelect={vi.fn()} asOf={AS_OF} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('ignores queued regions, which have nothing to review yet', () => {
    const queued = regionEntry({ region_id: 'us-tx-austin', name: 'Austin', status: 'requested' })
    renderList([...REGIONS, queued])
    expect(screen.queryByText('Austin')).not.toBeInTheDocument()
  })
})
