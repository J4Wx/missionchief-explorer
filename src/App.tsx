import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadIndex, loadRegion } from './data/regions'
import type { Facility, RegionFeatureCollection } from './types/app'
import { RegionPicker } from './ui/RegionPicker'
import { SubregionFilter } from './ui/SubregionFilter'
import { FacilityList } from './ui/FacilityList'
import { FacilityDetail } from './ui/FacilityDetail'
import { MapView, type MapCamera } from './map/MapView'
import { Legend } from './map/Legend'
import { bboxOf, toPosition, type Position } from './lib/geo'
import { subtreeIds } from './lib/subregions'

const FALLBACK_CENTER: Position = [-98.58, 39.83]
const FALLBACK_ZOOM = 4

export default function App() {
  const index = useMemo(() => loadIndex(), [])
  const regions = useMemo(
    () => index.regions.filter((r) => r.status === 'published'),
    [index],
  )

  const [regionId, setRegionId] = useState(regions[0]?.region_id ?? '')
  const [rawSubregionId, setSubregionId] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  const visible = useMemo(() => {
    const features = region?.features ?? []
    if (subregionId === 'all') return features
    const ids = subtreeIds(subregions, subregionId)
    return features.filter((f) => {
      const id = f.properties.subregion_id
      return id != null && ids.has(id)
    })
  }, [region, subregions, subregionId])

  const categoryCounts = useMemo(() => {
    const c: Partial<Record<Facility['category'], number>> = {}
    for (const f of visible) {
      const cat = f.properties.category
      c[cat] = (c[cat] ?? 0) + 1
    }
    return c
  }, [visible])

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
      bbox: sub?.bbox ?? (subCenter ? null : bboxOf(visible)),
    }
  }, [region, regionId, subregions, subregionId, visible])

  const selected = useMemo(
    () => visible.find((f) => f.properties.id === selectedId) ?? null,
    [visible, selectedId],
  )

  const clearSelection = useCallback(() => setSelectedId(null), [])

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      <header className="z-30 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">Dispatch Atlas</h1>
          {regions.length > 0 && (
            <RegionPicker regions={regions} value={regionId} onChange={setRegionId} />
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
          {region && (
            <span className="ml-auto text-sm text-slate-500">
              {visible.length} facilit{visible.length === 1 ? 'y' : 'ies'}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="m-4 rounded-md bg-red-50 p-4 text-red-700">
          Failed to load region: {error}
        </div>
      )}

      {!error && !region && <p className="p-6 text-slate-500">Loading…</p>}

      {region && (
        <main className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
          <aside className="flex min-h-0 basis-2/5 flex-col border-t border-slate-200 bg-white lg:w-96 lg:shrink-0 lg:grow-0 lg:basis-auto lg:border-r lg:border-t-0">
            <div className="border-b border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
              {region.metadata.name}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <FacilityList
                features={visible}
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
              features={visible}
              camera={camera}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />
            <Legend counts={categoryCounts} />
            {selected && (
              <div className="fixed inset-0 z-30 lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:z-20 lg:w-96 lg:border-l lg:border-slate-200 lg:shadow-xl">
                {/* Keyed so per-facility panel state starts fresh on each selection. */}
                <FacilityDetail
                  key={selected.properties.id}
                  feature={selected}
                  subregionName={subregionName(selected.properties.subregion_id)}
                  onClose={clearSelection}
                />
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  )
}
