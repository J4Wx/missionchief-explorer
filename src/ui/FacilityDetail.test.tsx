import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FacilityDetail } from './FacilityDetail'
import { feature } from '../test/fixtures'
import type { Facility } from '../types/app'

const FULL: Partial<Facility> = {
  id: 'sfd-1',
  name: 'Savannah Fire Station 1',
  category: 'fire',
  subtype: 'engine_house',
  status: 'active',
  agency: { name: 'Savannah Fire', level: 'municipal' },
  designation: 'Station 1',
  address: {
    street: '121 Habersham St',
    city: 'Savannah',
    county: 'Chatham',
    state: 'GA',
    postal_code: '31401',
    country: 'US',
  },
  staffing_model: 'career',
  operating_hours: '24_7',
  units: [
    { type: 'engine', designation: 'Engine 1', attributes: { pump_gpm: 1500 } },
    { type: 'ladder', count: 2 },
  ],
  specialties: ['hazmat', 'technical_rescue'],
  attributes: { apparatus_bays: 3, historic: true },
  game: { building_types: ['Fire Station'], recommended: true, notes: 'Build this first.' },
  significance: 'Oldest continuously staffed house in the city.',
  sources: [{ title: 'Department roster', url: 'https://example.test/roster', retrieved: '2026-01-14' }],
  confidence: 'high',
  last_verified: '2026-01-14',
}

function renderDetail(over: Partial<Facility> = FULL, subregionName: string | null = 'Downtown') {
  const onClose = vi.fn()
  const result = render(
    <FacilityDetail feature={feature(over, [-81.09123, 32.08094])} subregionName={subregionName} onClose={onClose} />,
  )
  return { ...result, onClose }
}

const section = (title: string) =>
  screen.getByRole('heading', { name: title }).closest('section') as HTMLElement

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FacilityDetail', () => {
  it('labels the panel with the facility it is showing', () => {
    renderDetail()
    expect(
      screen.getByRole('complementary', { name: 'Details for Savannah Fire Station 1' }),
    ).toBeInTheDocument()
  })

  it('heads with the name, category, subtype, status, agency and designation', () => {
    renderDetail()
    expect(screen.getByRole('heading', { level: 2, name: 'Savannah Fire Station 1' })).toBeInTheDocument()
    expect(screen.getByText('Fire')).toBeInTheDocument()
    expect(screen.getByText('Engine House')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Savannah Fire · Station 1')).toBeInTheDocument()
  })

  it('renders the address in its own country order', () => {
    renderDetail()
    const location = section('Location')
    expect(within(location).getByText('121 Habersham St')).toBeInTheDocument()
    expect(within(location).getByText('Savannah, GA 31401')).toBeInTheDocument()
  })

  it('renders a UK address with the postcode on its own line', () => {
    renderDetail({
      ...FULL,
      address: { street: 'Canning Place', city: 'Liverpool', county: 'Merseyside', postal_code: 'L1 8JX', country: 'GB' },
    })
    const location = section('Location')
    expect(within(location).getByText('Liverpool')).toBeInTheDocument()
    expect(within(location).getByText('L1 8JX')).toBeInTheDocument()
    expect(within(location).getByText(/Merseyside/)).toBeInTheDocument()
  })

  it('shows the county, sub-region and coordinates together', () => {
    renderDetail()
    expect(
      within(section('Location')).getByText('Chatham County · Downtown · 32.08094, -81.09123'),
    ).toBeInTheDocument()
  })

  it('links out to the map services with the facility coordinates', () => {
    renderDetail()
    expect(screen.getByRole('link', { name: /OpenStreetMap/ })).toHaveAttribute(
      'href',
      expect.stringContaining('mlat=32.08094&mlon=-81.09123'),
    )
    expect(screen.getByRole('link', { name: /Google Maps/ })).toHaveAttribute(
      'href',
      expect.stringContaining('query=32.08094,-81.09123'),
    )
  })

  it('renders the operations, units, specialties and attributes sections', () => {
    renderDetail()
    expect(within(section('Operations')).getByText('24/7')).toBeInTheDocument()
    expect(within(section('Operations')).getByText('Career')).toBeInTheDocument()
    expect(within(section('Operations')).getByText('Municipal')).toBeInTheDocument()

    const units = section('Units & apparatus (2)')
    expect(within(units).getByText('Engine 1')).toBeInTheDocument()
    expect(within(units).getByText('Pump Gpm: 1500')).toBeInTheDocument()
    expect(within(units).getByText('2')).toBeInTheDocument()

    expect(within(section('Specialties')).getByText('Technical Rescue')).toBeInTheDocument()
    expect(within(section('Attributes')).getByText('Apparatus Bays')).toBeInTheDocument()
    expect(within(section('Attributes')).getByText('Yes')).toBeInTheDocument()
  })

  it('renders the Mission Chief planning block', () => {
    renderDetail()
    const game = section('Mission Chief')
    expect(within(game).getByText('Fire Station')).toBeInTheDocument()
    expect(within(game).getByText('★ Recommended build')).toBeInTheDocument()
    expect(within(game).getByText('Build this first.')).toBeInTheDocument()
  })

  it('renders every source with its confidence and verification date', () => {
    renderDetail()
    const sources = section('Sources')
    expect(within(sources).getByText('High confidence')).toBeInTheDocument()
    expect(within(sources).getByText('Verified 2026-01-14')).toBeInTheDocument()
    const link = within(sources).getByRole('link', { name: 'Department roster' })
    expect(link).toHaveAttribute('href', 'https://example.test/roster')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('falls back to the URL when a source has no title', () => {
    renderDetail({ ...FULL, sources: [{ url: 'https://example.test/bare' }] })
    expect(
      within(section('Sources')).getByRole('link', { name: 'https://example.test/bare' }),
    ).toBeInTheDocument()
  })

  it('omits the sections a sparse record has nothing for', () => {
    renderDetail({ name: 'Bare Record', units: [], specialties: undefined, attributes: undefined })
    for (const title of ['Operations', 'Units & apparatus (0)', 'Specialties', 'Attributes', 'Significance']) {
      expect(screen.queryByRole('heading', { name: title })).not.toBeInTheDocument()
    }
    // The provenance sections are never optional.
    expect(screen.getByRole('heading', { name: 'Sources' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mission Chief' })).toBeInTheDocument()
  })

  describe('copy coordinates', () => {
    it('writes the pasteable "lat, lng" form to the clipboard', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      renderDetail()
      await userEvent.click(screen.getByRole('button', { name: 'Copy coordinates' }))
      expect(writeText).toHaveBeenCalledWith('32.08094, -81.09123')
      expect(await screen.findByRole('button', { name: 'Copied ✓' })).toBeInTheDocument()
      vi.unstubAllGlobals()
    })

    it('leaves the label alone when the clipboard is unavailable', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const writeText = vi.fn().mockRejectedValue(new Error('denied'))
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
      renderDetail()
      await userEvent.click(screen.getByRole('button', { name: 'Copy coordinates' }))
      expect(screen.getByRole('button', { name: 'Copy coordinates' })).toBeInTheDocument()
      vi.unstubAllGlobals()
    })
  })

  describe('keyboard and focus', () => {
    it('closes on the close button', async () => {
      const { onClose } = renderDetail()
      await userEvent.click(screen.getByRole('button', { name: 'Close details' }))
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('closes on Escape from anywhere on the page', async () => {
      const { onClose } = renderDetail()
      await userEvent.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledOnce()
    })

    it('stops listening for Escape once unmounted', async () => {
      const { onClose, unmount } = renderDetail()
      unmount()
      await userEvent.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
    })

    // The panel covers the viewport on narrow screens, so focus must not be
    // left stranded behind it.
    it('takes focus on open', () => {
      renderDetail()
      expect(screen.getByRole('complementary')).toHaveFocus()
    })

    it('hands focus back to whatever opened it', () => {
      const opener = document.createElement('button')
      document.body.append(opener)
      opener.focus()

      const { unmount } = renderDetail()
      expect(opener).not.toHaveFocus()

      unmount()
      expect(opener).toHaveFocus()
      opener.remove()
    })

    it('does not restore focus to an opener that has since gone away', () => {
      const opener = document.createElement('button')
      document.body.append(opener)
      opener.focus()

      const { unmount } = renderDetail()
      opener.remove()
      expect(() => unmount()).not.toThrow()
    })
  })
})
