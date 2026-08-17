import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegionBrowser } from './RegionBrowser'
import { regionEntry } from '../test/fixtures'

const savannah = regionEntry({
  region_id: 'us-ga-savannah',
  name: 'Savannah',
  admin: 'ga',
  admin_name: 'Georgia',
  center: [-81.1, 32.05],
  facility_count: 58,
})
const charleston = regionEntry({
  region_id: 'us-sc-charleston',
  name: 'Charleston',
  admin: 'sc',
  admin_name: 'South Carolina',
  center: [-79.95, 32.85],
  facility_count: 143,
})
const liverpool = regionEntry({
  region_id: 'gb-mersey-liverpool',
  name: 'Liverpool',
  country: 'GB',
  admin: 'mersey',
  admin_name: 'Merseyside',
  center: [-2.92, 53.45],
  facility_count: 72,
})

const REGIONS = [savannah, charleston, liverpool]

function renderBrowser(regions = REGIONS) {
  const props = { regions, hoveredId: null, onSelect: vi.fn(), onHover: vi.fn() }
  return { ...render(<RegionBrowser {...props} />), props }
}

describe('RegionBrowser', () => {
  it('lists every region as a button carrying its facility count', () => {
    renderBrowser()
    expect(screen.getByRole('button', { name: /Savannah\s*58 facilities/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Liverpool\s*72 facilities/ })).toBeInTheDocument()
  })

  it('groups regions under their country and division', () => {
    renderBrowser()
    const groups = screen.getAllByRole('group').map((g) => g.getAttribute('aria-label'))
    expect(groups).toContain('United States')
    expect(groups).toContain('Georgia')
    // One British region means no division level to branch — as in the picker.
    expect(groups).toContain('United Kingdom')
    expect(groups).not.toContain('Merseyside')
  })

  it('opens the region it was asked for', async () => {
    const { props } = renderBrowser()
    await userEvent.click(screen.getByRole('button', { name: /Charleston/ }))
    expect(props.onSelect).toHaveBeenCalledWith('us-sc-charleston')
  })

  it('reports hover so the map can highlight the same region', async () => {
    const { props } = renderBrowser()
    await userEvent.hover(screen.getByRole('button', { name: /Savannah/ }))
    expect(props.onHover).toHaveBeenCalledWith('us-ga-savannah')
  })

  it('moves between rows with the arrow keys', async () => {
    renderBrowser()
    const rows = screen.getAllByRole('button')
    rows[0].focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(rows[1])
    await userEvent.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(rows[0])
  })

  it('says so when nothing is published yet', () => {
    renderBrowser([])
    expect(screen.getByText(/No regions are published yet/)).toBeInTheDocument()
  })
})
