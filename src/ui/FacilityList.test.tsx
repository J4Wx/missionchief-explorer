import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FacilityList } from './FacilityList'
import { feature } from '../test/fixtures'
import type { FacilityFeature } from '../types/app'

const FEATURES = [
  feature({
    id: 'sfd-1',
    name: 'Savannah Fire Station 1',
    agency: { name: 'Savannah Fire' },
    designation: 'Station 1',
    subregion_id: 'downtown',
    units: [
      { type: 'engine', designation: 'Engine 1' },
      { type: 'ladder', count: 2 },
    ],
    specialties: ['hazmat'],
  }),
  feature({ id: 'mem-1', name: 'Memorial Health', category: 'hospital', agency: { name: 'Memorial' } }),
  feature({ id: 'pd-1', name: 'Savannah PD HQ', category: 'police_local', agency: { name: 'SPD' } }),
]

type Props = Parameters<typeof FacilityList>[0]

function renderList(over: Partial<Props> = {}, features = FEATURES) {
  const onSelect = vi.fn<Props['onSelect']>()
  const onHover = vi.fn<Props['onHover']>()
  const props: Props = {
    features,
    subregionName: (id) => (id === 'downtown' ? 'Downtown' : null),
    selectedId: null,
    hoveredId: null,
    onSelect,
    onHover,
    ...over,
  }
  return { ...render(<FacilityList {...props} />), props: { ...props, onSelect, onHover } }
}

const rows = () => screen.getAllByRole('button')

describe('FacilityList', () => {
  it('renders a row per facility', () => {
    renderList()
    expect(rows()).toHaveLength(3)
    expect(screen.getByText('Savannah Fire Station 1')).toBeInTheDocument()
  })

  it('shows the agency, designation, sub-region, units and specialties', () => {
    renderList()
    const row = rows()[0]
    expect(within(row).getByText('Savannah Fire')).toBeInTheDocument()
    expect(within(row).getByText('· Station 1')).toBeInTheDocument()
    expect(within(row).getByText('Downtown')).toBeInTheDocument()
    expect(within(row).getByText('Units: Engine 1, 2× ladder')).toBeInTheDocument()
    expect(within(row).getByText('hazmat')).toBeInTheDocument()
  })

  it('names the category for screen readers, not by badge color alone', () => {
    renderList()
    expect(within(rows()[1]).getByText(/Hospital/)).toBeInTheDocument()
  })

  it('renders an empty state instead of a list when nothing matches', () => {
    renderList({}, [])
    expect(screen.getByText('No facilities match the current selection.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('marks the selected row with aria-current', () => {
    renderList({ selectedId: 'mem-1' })
    expect(rows()[1]).toHaveAttribute('aria-current', 'true')
    expect(rows()[0]).not.toHaveAttribute('aria-current')
  })

  it('reports the facility id on click', async () => {
    const { props } = renderList()
    await userEvent.click(rows()[2])
    expect(props.onSelect).toHaveBeenCalledWith('pd-1')
  })

  it('reports hover on pointer enter and on focus', async () => {
    const { props } = renderList()
    await userEvent.hover(rows()[0])
    expect(props.onHover).toHaveBeenCalledWith('sfd-1')

    props.onHover.mockClear()
    rows()[1].focus()
    expect(props.onHover).toHaveBeenCalledWith('mem-1')
  })

  it('clears hover when the pointer leaves the list', async () => {
    const { props } = renderList()
    await userEvent.hover(rows()[0])
    await userEvent.unhover(rows()[0])
    expect(props.onHover).toHaveBeenCalledWith(null)
  })

  describe('keyboard navigation', () => {
    it('moves focus down and up with the arrow keys', async () => {
      renderList()
      rows()[0].focus()

      await userEvent.keyboard('{ArrowDown}')
      expect(rows()[1]).toHaveFocus()

      await userEvent.keyboard('{ArrowDown}')
      expect(rows()[2]).toHaveFocus()

      await userEvent.keyboard('{ArrowUp}')
      expect(rows()[1]).toHaveFocus()
    })

    it('stops at the ends rather than wrapping', async () => {
      renderList()
      rows()[0].focus()
      await userEvent.keyboard('{ArrowUp}')
      expect(rows()[0]).toHaveFocus()

      rows()[2].focus()
      await userEvent.keyboard('{ArrowDown}')
      expect(rows()[2]).toHaveFocus()
    })

    it('leaves other keys to the browser', async () => {
      const { props } = renderList()
      rows()[0].focus()
      await userEvent.keyboard('{Enter}')
      expect(props.onSelect).toHaveBeenCalledWith('sfd-1')
    })
  })

  it('keeps a selected row scrolled into view', () => {
    const scrollIntoView = vi.fn()
    vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(scrollIntoView)
    renderList({ selectedId: 'pd-1' })
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    vi.restoreAllMocks()
  })

  it('escapes an id with CSS-special characters when scrolling to it', () => {
    const odd: FacilityFeature[] = [feature({ id: 'fire.1:a', name: 'Odd Id Station' })]
    expect(() => renderList({ selectedId: 'fire.1:a' }, odd)).not.toThrow()
  })
})
