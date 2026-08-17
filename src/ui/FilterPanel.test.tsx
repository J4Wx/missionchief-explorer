import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterPanel } from './FilterPanel'
import { computeFacets, EMPTY_FILTERS, type Filters } from '../lib/filters'
import { feature } from '../test/fixtures'

const FEATURES = [
  feature({ category: 'fire', agency: { name: 'Savannah Fire' }, specialties: ['hazmat'], staffing_model: 'career' }),
  feature({ category: 'fire', agency: { name: 'Chatham Fire' }, staffing_model: 'volunteer' }),
  feature({ category: 'hospital', agency: { name: 'Memorial Health' }, specialties: ['trauma_major'] }),
]

function renderPanel(over: Partial<Filters> = {}, extra: { resultCount?: number } = {}) {
  const filters: Filters = { ...EMPTY_FILTERS, ...over }
  const props = {
    facets: computeFacets(FEATURES, filters),
    filters,
    resultCount: extra.resultCount ?? FEATURES.length,
    totalCount: FEATURES.length,
    onToggle: vi.fn(),
    onClear: vi.fn(),
  }
  return { ...render(<FilterPanel {...props} />), props }
}

const group = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}`) })

describe('FilterPanel', () => {
  it('renders a collapsible group per non-empty dimension', () => {
    renderPanel()
    for (const label of ['Category', 'Agency', 'Specialty', 'Staffing']) {
      expect(group(label)).toHaveAttribute('aria-expanded', 'false')
    }
  })

  it('omits a dimension with no options at all', () => {
    const props = {
      facets: { categories: [], agencies: [], specialties: [], staffing: [], statuses: [] },
      filters: EMPTY_FILTERS,
      resultCount: 0,
      totalCount: 0,
      onToggle: vi.fn(),
      onClear: vi.fn(),
    }
    render(<FilterPanel {...props} />)
    expect(screen.queryByRole('button', { name: /^Category/ })).not.toBeInTheDocument()
  })

  it('shows the total alone when nothing is filtered out', () => {
    renderPanel()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows "n of total" once the set is narrowed', () => {
    renderPanel({ categories: ['fire'] }, { resultCount: 2 })
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
  })

  it('hides the count badge and Clear all until something is selected', () => {
    renderPanel()
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument()
  })

  it('badges the number of active constraints and offers Clear all', async () => {
    const { props } = renderPanel({ categories: ['fire'], specialties: ['hazmat'] })
    expect(screen.getByText('2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(props.onClear).toHaveBeenCalledOnce()
  })

  describe('facet groups', () => {
    it('reveal their options with live counts when expanded', async () => {
      renderPanel()
      await userEvent.click(group('Category'))
      expect(group('Category')).toHaveAttribute('aria-expanded', 'true')

      const fire = screen.getByRole('checkbox', { name: /Fire/ })
      expect(within(fire).getByText('2')).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /Hospital/ })).toBeInTheDocument()
    })

    it('start expanded when the dimension already has a selection', () => {
      renderPanel({ categories: ['fire'] })
      expect(group('Category')).toHaveAttribute('aria-expanded', 'true')
      expect(group('Agency')).toHaveAttribute('aria-expanded', 'false')
    })

    it('collapse again on a second click', async () => {
      renderPanel()
      await userEvent.click(group('Specialty'))
      await userEvent.click(group('Specialty'))
      expect(group('Specialty')).toHaveAttribute('aria-expanded', 'false')
    })

    it('expose each option as a checkbox reflecting its selected state', () => {
      renderPanel({ categories: ['fire'] })
      expect(screen.getByRole('checkbox', { name: /Fire/ })).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByRole('checkbox', { name: /Hospital/ })).toHaveAttribute(
        'aria-checked',
        'false',
      )
    })

    it('report a toggle with the dimension and the raw value', async () => {
      const { props } = renderPanel()
      await userEvent.click(group('Category'))
      await userEvent.click(screen.getByRole('checkbox', { name: /Hospital/ }))
      expect(props.onToggle).toHaveBeenCalledWith('categories', 'hospital')
    })

    it('humanize option labels but keep the underlying value', async () => {
      const { props } = renderPanel()
      await userEvent.click(group('Specialty'))
      await userEvent.click(screen.getByRole('checkbox', { name: /Trauma Major/ }))
      expect(props.onToggle).toHaveBeenCalledWith('specialties', 'trauma_major')
    })

    it('explain the hidden-by-default statuses', async () => {
      renderPanel()
      await userEvent.click(group('Status'))
      expect(
        screen.getByText('Closed and planned are hidden unless selected.'),
      ).toBeInTheDocument()
    })

    it('are operable from the keyboard', async () => {
      const { props } = renderPanel()
      group('Category').focus()
      await userEvent.keyboard('{Enter}')
      expect(group('Category')).toHaveAttribute('aria-expanded', 'true')

      screen.getByRole('checkbox', { name: /Fire/ }).focus()
      await userEvent.keyboard(' ')
      expect(props.onToggle).toHaveBeenCalledWith('categories', 'fire')
    })
  })

  describe('chips', () => {
    // Each chip names its own removal for screen readers, alongside the visible
    // label — so the accessible name reads "Fire Remove Fire filter".
    const chip = (label: string) =>
      screen.getByRole('button', { name: new RegExp(`Remove ${label} filter$`) })

    it('surface every selected value across dimensions', () => {
      renderPanel({ categories: ['fire'], specialties: ['trauma_major'] })
      expect(chip('Fire')).toBeInTheDocument()
      expect(chip('Trauma Major')).toBeInTheDocument()
    })

    it('remove their value when clicked', async () => {
      const { props } = renderPanel({ agencies: ['Savannah Fire'] })
      await userEvent.click(chip('Savannah Fire'))
      expect(props.onToggle).toHaveBeenCalledWith('agencies', 'Savannah Fire')
    })

    it('are absent when nothing is selected', () => {
      renderPanel()
      expect(screen.queryByRole('button', { name: /Remove .* filter$/ })).not.toBeInTheDocument()
    })

    it('do not appear for the free-text query, which has its own box', () => {
      renderPanel({ query: 'engine' })
      expect(screen.queryByRole('button', { name: /Remove .* filter$/ })).not.toBeInTheDocument()
    })
  })
})
