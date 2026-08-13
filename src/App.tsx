import { useEffect, useMemo, useState } from 'react'
import { loadIndex, loadRegion } from './data/regions'
import type { RegionFeatureCollection } from './types/app'
import { RegionPicker } from './ui/RegionPicker'
import { SubregionFilter } from './ui/SubregionFilter'
import { FacilityList } from './ui/FacilityList'

export default function App() {
  const index = useMemo(() => loadIndex(), [])
  const regions = useMemo(
    () => index.regions.filter((r) => r.status === 'published'),
    [index],
  )

  const [regionId, setRegionId] = useState(regions[0]?.region_id ?? '')
  const [region, setRegion] = useState<RegionFeatureCollection | null>(null)
  const [subregionId, setSubregionId] = useState('all')
  const [error, setError] = useState<string | null>(null)

  const entry = regions.find((r) => r.region_id === regionId)
  const file = entry?.file

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setRegion(null)
    setError(null)
    setSubregionId('all')
    loadRegion(file)
      .then((r) => !cancelled && setRegion(r))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [file])

  const subregions = region?.metadata.subregions ?? []

  const subregionName = (id: string | null | undefined): string | null =>
    id ? (subregions.find((s) => s.id === id)?.name ?? id) : null

  // Facility counts per sub-region (for the filter labels).
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const f of region?.features ?? []) {
      const id = f.properties.subregion_id
      if (id) c[id] = (c[id] ?? 0) + 1
    }
    return c
  }, [region])

  const visible = useMemo(() => {
    const features = region?.features ?? []
    if (subregionId === 'all') return features
    return features.filter((f) => f.properties.subregion_id === subregionId)
  }, [region, subregionId])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-4 px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">Dispatch Atlas</h1>
          {regions.length > 0 && (
            <RegionPicker regions={regions} value={regionId} onChange={setRegionId} />
          )}
          <SubregionFilter
            subregions={subregions}
            counts={counts}
            value={subregionId}
            onChange={setSubregionId}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-700">Failed to load region: {error}</div>
        )}
        {!error && !region && <p className="text-slate-500">Loading…</p>}
        {region && (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-sm text-slate-600">
              <span className="font-medium">{region.metadata.name}</span>
              <span>{visible.length} facilities</span>
            </div>
            <FacilityList features={visible} subregionName={subregionName} />
          </section>
        )}
      </main>
    </div>
  )
}
