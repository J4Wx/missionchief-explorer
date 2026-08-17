import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadIndex, loadRegion } from './data/regions'
import type { Facility, RegionFeatureCollection } from './types/app'
import { RegionPicker } from './ui/RegionPicker'
import { SubregionFilter } from './ui/SubregionFilter'
import { SearchBox } from './ui/SearchBox'
import { FilterPanel } from './ui/FilterPanel'
import { FacilityList } from './ui/FacilityList'
import { FacilityDetail } from './ui/FacilityDetail'
import { MapView, type MapCamera } from './map/MapView'
import { GlobalMap } from './map/GlobalMap'
import { Legend } from './map/Legend'
import { bboxOf, toPosition, type Position } from './lib/geo'
import { pinnedFacilityCount, regionPins } from './lib/regionPins'
import { RegionBrowser } from './ui/RegionBrowser'
import { subtreeIds } from './lib/subregions'
import {
  computeFacets,
  EMPTY_FILTERS,
  matchesFacets,
  toggleFacet,
  type FacetKey,
  type Filters,
} from './lib/filters'
import { useSearch } from './lib/search'
import { parseUrl, writeUrl } from './lib/url'
import { useTheme } from './lib/theme'
import { ThemeToggle } from './ui/ThemeToggle'
import { AboutPanel } from './ui/AboutPanel'

const FALLBACK_CENTER: Position = [-98.58, 39.83]
const FALLBACK_ZOOM = 4

export default function App() {
  const { preference: themePreference, resolved: theme, setPreference: setTheme } = useTheme()

  const index = useMemo(() => loadIndex(), [])
  const regions = useMemo(
    () => index.regions.filter((r) => r.status === 'published'),
    [index],
  )

  // Where each published region sits on the global map. The registry carries
  // the pin, so the landing view costs no region files (docs/05).
  const pins = useMemo(() => regionPins(regions), [regions])

  // Initial state comes from the URL so deep links open the shared view.
  const initial = useMemo(() => parseUrl(), [])

  // `null` is the global map — the default view, and where an unrecognized
  // ?region lands rather than silently opening some other city's data.
  const [regionId, setRegionId] = useState<string | null>(() =>
    initial.regionId && regions.some((r) => r.region_id === initial.regionId)
      ? initial.regionId
      : null,
  )
  const [rawSubregionId, setSubregionId] = useState(initial.subregionId ?? 'all')
  const [filters, setFilters] = useState<Filters>(initial.filters)
  const [selectedId, setSelectedId] = useState<string | null>(initial.selectedId)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(initial.about)

  // Switching region resets the region-specific narrowing (agencies, sub-region
  // and selection differ per region); deep-link init above is preserved.
  const changeRegion = useCallback((id: string | null) => {
    setRegionId(id)
    setSubregionId('all')
    setFilters(EMPTY_FILTERS)
    setSelectedId(null)
  }, [])

  // Back out to the global map — the same reset, plus the region itself.
  const showGlobal = useCallback(() => changeRegion(null), [changeRegion])

  const toggleFilter = useCallback(
    (key: FacetKey, value: string) => setFilters((f) => toggleFacet(f, key, value)),
    [],
  )
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])
  const setQuery = useCallback((query: string) => setFilters((f) => ({ ...f, query })), [])

  const entry = regions.find((r) => r.region_id === regionId)
  const file = entry?.file

  // Load results are tagged with the file they came from, so switching regions
  // shows the loading state without any state reset on the way through.
  const [loaded, setLoaded] = useState<{ file: string; data: RegionFeatureCollection } | null>(
    null,
  )
  const [failed, setFailed] = useState<{ file: string; message: string } | null>(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    loadRegion(file)
      .then((data) => !cancelled && setLoaded({ file, data }))
      .catch((e) => !cancelled && setFailed({ file, message: String(e) }))
    return () => {
      cancelled = true
    }
  }, [file])

  const region = loaded && loaded.file === file ? loaded.data : null
  const error = failed && failed.file === file ? failed.message : null

  const subregions = useMemo(() => region?.metadata.subregions ?? [], [region])

  // A sub-region selection only applies to the region that declares it; after a
  // region switch it falls back to "all" rather than needing a reset.
  const subregionId = subregions.some((s) => s.id === rawSubregionId) ? rawSubregionId : 'all'

  const subregionName = useCallback(
    (id: string | null | undefined): string | null =>
      id ? (subregions.find((s) => s.id === id)?.name ?? id) : null,
    [subregions],
  )

  // Facility counts per sub-region, including nested descendants.
  const counts = useMemo(() => {
    const direct: Record<string, number> = {}
    for (const f of region?.features ?? []) {
      const id = f.properties.subregion_id
      if (id) direct[id] = (direct[id] ?? 0) + 1
    }
    const totals: Record<string, number> = {}
    for (const sub of subregions) {
      let total = 0
      for (const id of subtreeIds(subregions, sub.id)) total += direct[id] ?? 0
      totals[sub.id] = total
    }
    return totals
  }, [region, subregions])

  // Sub-region narrowing: the set the facet options and map framing describe.
  const narrowed = useMemo(() => {
    const features = region?.features ?? []
    if (subregionId === 'all') return features
    const ids = subtreeIds(subregions, subregionId)
    return features.filter((f) => {
      const id = f.properties.subregion_id
      return id != null && ids.has(id)
    })
  }, [region, subregions, subregionId])

  // Facet options + counts, cross-filtered by the current selection: each
  // dimension counts against the *other* active filters, so options that the
  // rest of the selection has ruled out drop away.
  const facets = useMemo(() => computeFacets(narrowed, filters), [narrowed, filters])

  // The final view: facet filters, then fuzzy search. Feeds map + list + legend.
  const facetFiltered = useMemo(
    () => narrowed.filter((f) => matchesFacets(f.properties, filters)),
    [narrowed, filters],
  )
  const results = useSearch(facetFiltered, filters.query)

  const categoryCounts = useMemo(() => {
    const c: Partial<Record<Facility['category'], number>> = {}
    for (const f of results) {
      const cat = f.properties.category
      c[cat] = (c[cat] ?? 0) + 1
    }
    return c
  }, [results])

  // Where the map sits: the region's declared view, or the selected
  // sub-region's own center/bbox when it has one.
  const camera = useMemo<MapCamera>(() => {
    const regionCenter = toPosition(region?.metadata.center) ?? FALLBACK_CENTER
    const regionZoom = region?.metadata.zoom ?? FALLBACK_ZOOM
    const key = `${regionId}:${subregionId}`

    if (subregionId === 'all') {
      return { key, center: regionCenter, zoom: regionZoom, bbox: null }
    }

    const sub = subregions.find((s) => s.id === subregionId)
    const subCenter = toPosition(sub?.center)
    return {
      key,
      center: subCenter ?? regionCenter,
      zoom: sub?.zoom ?? Math.max(regionZoom, 12),
      // Prefer a declared bbox; otherwise frame whatever is in the sub-region.
      bbox: sub?.bbox ?? (subCenter ? null : bboxOf(narrowed)),
    }
  }, [region, regionId, subregions, subregionId, narrowed])

  const selected = useMemo(
    () => results.find((f) => f.properties.id === selectedId) ?? null,
    [results, selectedId],
  )

  const clearSelection = useCallback(() => setSelectedId(null), [])

  // Reflect the current view into the URL for deep links / sharing.
  useEffect(() => {
    writeUrl({ regionId, subregionId, filters, selectedId, about: aboutOpen })
  }, [regionId, subregionId, filters, selectedId, aboutOpen])

  return (
    <div className="flex h-screen flex-col bg-page text-ink">
      {/* Neither map is reachable without a pointer; the list beside it is its
          equivalent (docs/05), so that is where the skip link lands. */}
      <a
        href={regionId ? '#facility-results' : '#region-results'}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-accent-strong focus:px-3 focus:py-2 focus:text-sm focus:text-accent-ink"
      >
        {regionId ? 'Skip to facility results' : 'Skip to the region list'}
      </a>
      <header className="z-30 border-b border-hairline bg-surface">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          {/* The title is the way back out to the global map — the one control
              that is in the same place in both views. */}
          <h1 className="text-lg font-bold">
            <button
              type="button"
              onClick={showGlobal}
              aria-label={
                regionId
                  ? 'Dispatch Atlas — back to the global map'
                  : 'Dispatch Atlas — the global map'
              }
              aria-current={regionId ? undefined : 'page'}
              title={regionId ? 'Back to the global map' : undefined}
              className="rounded text-ink hover:text-accent"
            >
              Dispatch Atlas
            </button>
          </h1>
          {regions.length > 0 && (
            <RegionPicker regions={regions} value={regionId ?? ''} onChange={changeRegion} />
          )}
          <SubregionFilter
            subregions={subregions}
            counts={counts}
            value={subregionId}
            onChange={(value) => {
              setSubregionId(value)
              setSelectedId(null)
            }}
          />
          {region && <SearchBox value={filters.query} onChange={setQuery} />}
          <div className="ml-auto flex items-center gap-3">
            {regionId ? (
              region && (
                <span className="text-sm text-ink-faint">
                  {results.length} facilit{results.length === 1 ? 'y' : 'ies'}
                </span>
              )
            ) : (
              <span className="text-sm text-ink-faint">
                {regions.length} region{regions.length === 1 ? '' : 's'} ·{' '}
                {pinnedFacilityCount(pins)} facilities
              </span>
            )}
            <button
              type="button"
              onClick={() => setAboutOpen(true)}
              className="rounded-md border border-hairline-strong px-2 py-1 text-sm text-ink hover:bg-surface-3"
            >
              About
            </button>
            <ThemeToggle value={themePreference} onChange={setTheme} />
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="m-4 rounded-md bg-rose-50 p-4 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
        >
          Failed to load region: {error}
        </div>
      )}

      {regionId && !error && !region && (
        <p role="status" className="p-6 text-ink-faint">
          Loading…
        </p>
      )}

      {!regionId && (
        <main className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
          <aside className="flex min-h-0 basis-2/5 flex-col border-t border-hairline bg-surface lg:w-96 lg:shrink-0 lg:grow-0 lg:basis-auto lg:border-r lg:border-t-0">
            <div className="border-b border-hairline px-4 py-2 text-sm font-medium text-ink-muted">
              Coverage
            </div>
            <div
              id="region-results"
              tabIndex={-1}
              aria-label="Covered regions"
              className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
            >
              <p className="px-4 py-3 text-sm text-ink-muted">
                Pick a region — on the map or here — to browse its stations, hospitals and
                depots.
              </p>
              <RegionBrowser
                regions={regions}
                hoveredId={hoveredRegionId}
                onSelect={changeRegion}
                onHover={setHoveredRegionId}
              />
            </div>
          </aside>

          <div className="relative min-h-0 flex-1">
            <GlobalMap
              pins={pins}
              hoveredId={hoveredRegionId}
              theme={theme}
              onSelect={changeRegion}
              onHover={setHoveredRegionId}
            />
          </div>
        </main>
      )}

      {regionId && region && (
        <main className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
          <aside className="flex min-h-0 basis-2/5 flex-col border-t border-hairline bg-surface lg:w-96 lg:shrink-0 lg:grow-0 lg:basis-auto lg:border-r lg:border-t-0">
            <div className="border-b border-hairline px-4 py-2 text-sm font-medium text-ink-muted">
              {region.metadata.name}
            </div>
            <FilterPanel
              facets={facets}
              filters={filters}
              resultCount={results.length}
              totalCount={narrowed.length}
              onToggle={toggleFilter}
              onClear={clearFilters}
            />
            <div
              id="facility-results"
              tabIndex={-1}
              aria-label="Facility results"
              className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
            >
              <FacilityList
                features={results}
                subregionName={subregionName}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={setSelectedId}
                onHover={setHoveredId}
              />
            </div>
          </aside>

          <div className="relative min-h-0 flex-1">
            <MapView
              features={results}
              camera={camera}
              selectedId={selectedId}
              hoveredId={hoveredId}
              theme={theme}
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />
            <Legend counts={categoryCounts} />
            {selected && (
              <div className="fixed inset-0 z-30 lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:z-20 lg:w-96 lg:border-l lg:border-hairline lg:shadow-xl">
                {/* Keyed so per-facility panel state starts fresh on each selection. */}
                <FacilityDetail
                  key={selected.properties.id}
                  feature={selected}
                  regionId={regionId}
                  subregionName={subregionName(selected.properties.subregion_id)}
                  onClose={clearSelection}
                />
              </div>
            )}
          </div>
        </main>
      )}

      {aboutOpen && (
        <AboutPanel
          regions={index.regions}
          region={region}
          onClose={() => setAboutOpen(false)}
        />
      )}
    </div>
  )
}
