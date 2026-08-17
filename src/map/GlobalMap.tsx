// The global map: one pin per published region, and a click to open it.
//
// This is where the app opens (docs/05). It deliberately reuses the facility
// map's cluster bubble for its pins — zoomed out this far a region *is* a
// cluster of facilities, so the bubble carrying a count and expanding on click
// already means the right thing. The regions it plots come from the registry
// alone, so the landing view costs no region files.
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Map as MapLibreMap, Popup, type GeoJSONSource } from 'maplibre-gl'
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { FeatureCollection, Point } from 'geojson'
import type { Position } from '../lib/geo'
import { pinBounds, type RegionPin } from '../lib/regionPins'
import type { ResolvedTheme } from '../lib/theme'
import {
  MAP_CHROME,
  MAP_FONT,
  MapSurface,
  SELECTED_RING,
  motion,
  useBasemap,
} from './basemap'

const SOURCE_ID = 'regions'
const LAYER_HOVER = 'region-hover'
const LAYER_PINS = 'region-pins'
const LAYER_COUNTS = 'region-counts'
const LAYER_LABELS = 'region-labels'

/** Where the map opens before it has framed the pins. */
const WORLD_CENTER: Position = [-30, 42]
const WORLD_ZOOM = 1.4
/** Close enough to tell regions apart, far enough to keep the world legible. */
const MAX_FIT_ZOOM = 6

/**
 * Facilities behind a bubble: a cluster's summed total, or one region's own.
 * The number in a bubble always counts facilities, whichever it is — what
 * changes is the label under it.
 */
const TOTAL: ExpressionSpecification = ['coalesce', ['get', 'facilities'], ['get', 'count'], 0]

/** Bubble size by catalog depth — the facility map's cluster ramp. */
const RADIUS: ExpressionSpecification = ['step', TOTAL, 16, 25, 20, 75, 24]

const UNCLUSTERED: ExpressionSpecification = ['!', ['has', 'point_count']]

/** Filter matching the one unclustered pin with this region id (or nothing). */
function idFilter(id: string | null): ExpressionSpecification {
  return ['all', UNCLUSTERED, ['==', ['get', 'id'], id ?? '\0']]
}

interface PinProps {
  id: string
  name: string
  count?: number
}

/** What a bubble stands for: one region, or the several inside a cluster. */
interface ClusterProps {
  cluster_id: number
  point_count: number
  facilities: number
}

function toGeoJSON(pins: RegionPin[]): FeatureCollection<Point, PinProps> {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: pin.center },
      properties: {
        id: pin.entry.region_id,
        name: pin.entry.name,
        // Left off rather than zeroed when unknown, so the bubble can tell
        // "no count recorded" from "a region with nothing in it".
        ...(pin.count == null ? {} : { count: pin.count }),
      },
    })),
  }
}

const facilities = (n: number) => `${n} facilit${n === 1 ? 'y' : 'ies'}`

/** Hover popup body. Built as DOM (not HTML) so data can't inject markup. */
function popupContent(props: PinProps | ClusterProps): HTMLElement {
  const [heading, detail] =
    'point_count' in props
      ? [`${props.point_count} regions`, `${facilities(props.facilities)} · zoom in to pick one`]
      : [
          props.name,
          [props.count == null ? null : facilities(props.count), 'open this region']
            .filter(Boolean)
            .join(' · '),
        ]

  const root = document.createElement('div')
  root.className = 'text-sm leading-tight'

  const title = document.createElement('div')
  title.className = 'font-semibold text-ink'
  title.textContent = heading
  root.append(title)

  const meta = document.createElement('div')
  meta.className = 'text-ink-muted'
  meta.textContent = detail
  root.append(meta)

  return root
}

/** Add the region source and its layers to whatever style is loaded. */
function installLayers(map: MapLibreMap, theme: ResolvedTheme): void {
  const chrome = MAP_CHROME[theme]

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: toGeoJSON([]),
    // Two cities an hour apart are the same point on a world map, so regions
    // cluster exactly as facilities do — one bubble, a click to open it up.
    cluster: true,
    clusterRadius: 44,
    // Carry the facilities up into the cluster, so its bubble counts the same
    // thing a single region's does.
    clusterProperties: { facilities: ['+', ['coalesce', ['get', 'count'], 0]] },
  })

  map.addLayer({
    id: LAYER_HOVER,
    type: 'circle',
    source: SOURCE_ID,
    filter: idFilter(null),
    paint: {
      'circle-color': chrome.cluster,
      'circle-opacity': 0.25,
      'circle-radius': ['step', TOTAL, 26, 25, 30, 75, 34],
    },
  })

  map.addLayer({
    id: LAYER_PINS,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': chrome.cluster,
      'circle-radius': RADIUS,
      'circle-stroke-width': 2,
      'circle-stroke-color': chrome.ring,
    },
  })

  map.addLayer({
    id: LAYER_COUNTS,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'text-field': [
        'case',
        ['any', ['has', 'point_count'], ['has', 'count']],
        ['to-string', TOTAL],
        '',
      ],
      'text-font': MAP_FONT,
      'text-size': 12,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': chrome.clusterInk },
  })

  map.addLayer({
    id: LAYER_LABELS,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'text-field': [
        'case',
        ['has', 'point_count'],
        ['concat', ['to-string', ['get', 'point_count']], ' regions'],
        ['get', 'name'],
      ],
      'text-font': MAP_FONT,
      'text-size': 12,
      'text-anchor': 'top',
      // Clear of the bubble at its widest, so the two never collide.
      'text-offset': [0, 1.9],
      'text-max-width': 9,
    },
    paint: {
      'text-color': SELECTED_RING[theme],
      'text-halo-color': chrome.ring,
      'text-halo-width': 1.5,
    },
  })
}

interface Props {
  pins: RegionPin[]
  hoveredId: string | null
  theme: ResolvedTheme
  onSelect: (regionId: string) => void
  onHover: (regionId: string | null) => void
}

export function GlobalMap({ pins, hoveredId, theme, onSelect, onHover }: Props) {
  const popupRef = useRef<Popup | null>(null)

  const handlers = useRef({ onSelect, onHover })
  useEffect(() => {
    handlers.current = { onSelect, onHover }
  }, [onSelect, onHover])

  const onCreate = useCallback((map: MapLibreMap) => {
    // A bubble opens a region, or — where several sit on top of each other —
    // zooms until they come apart.
    map.on('click', LAYER_PINS, (e) => {
      const feature = e.features?.[0]
      if (!feature || feature.geometry.type !== 'Point') return
      const props = feature.properties as PinProps | ClusterProps
      if ('point_count' in props) {
        const center = feature.geometry.coordinates as Position
        // The cluster is about to become several pins; its popup would hang
        // around describing something that is no longer under the pointer.
        popupRef.current?.remove()
        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
        source
          ?.getClusterExpansionZoom(props.cluster_id)
          .then((zoom) => map.easeTo({ center, zoom, duration: motion(500) }))
          .catch((err) => console.error('Cluster expansion failed', err))
      } else if (typeof props.id === 'string') {
        handlers.current.onSelect(props.id)
      }
    })

    map.on('mousemove', LAYER_PINS, (e) => {
      const feature = e.features?.[0]
      if (!feature || feature.geometry.type !== 'Point') return
      map.getCanvas().style.cursor = 'pointer'
      const props = feature.properties as PinProps | ClusterProps
      // A cluster stands for several regions, so it highlights none of them.
      handlers.current.onHover('point_count' in props ? null : props.id)

      const popup =
        popupRef.current ??
        (popupRef.current = new Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 18,
        }))
      popup
        .setLngLat(feature.geometry.coordinates as Position)
        .setDOMContent(popupContent(props))
        .addTo(map)
    })

    map.on('mouseleave', LAYER_PINS, () => {
      map.getCanvas().style.cursor = ''
      handlers.current.onHover(null)
      popupRef.current?.remove()
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [])

  const { containerRef, mapRef, ready, failed } = useBasemap({
    theme,
    center: WORLD_CENTER,
    zoom: WORLD_ZOOM,
    install: installLayers,
    onCreate,
  })

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(toGeoJSON(pins))
  }, [pins, ready, mapRef])

  // Frame the coverage: whatever is on the map, once. Re-framing on every pin
  // change would fight the user the moment they pan.
  const bounds = useMemo(() => pinBounds(pins), [pins])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !bounds) return
    map.fitBounds(bounds, { padding: 80, maxZoom: MAX_FIT_ZOOM, duration: motion(600) })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setFilter(LAYER_HOVER, idFilter(hoveredId))
  }, [hoveredId, ready, mapRef])

  return (
    <MapSurface
      containerRef={containerRef}
      label="Map of covered regions"
      failed={failed}
      fallback="The region list beside it still works."
    />
  )
}
