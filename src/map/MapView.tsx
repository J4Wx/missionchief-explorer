// MapLibre GL map: a clustered GeoJSON source of the currently visible
// facilities, colored by service group and badged with a per-category code.
//
// The map owns no data — it renders the same filtered feature set as the
// results list and reports selection/hover back up, so the two views stay in
// sync (docs/05). The basemap underneath it (style, theme swap, motion) is
// shared with the global map; see ./basemap.
import { useCallback, useEffect, useRef } from 'react'
import { Map as MapLibreMap, Popup, type GeoJSONSource } from 'maplibre-gl'
// maplibre-gl re-uses the style-spec types for expressions; import them from
// the same package it does so layer definitions stay type-checked.
import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec'
import type { FeatureCollection, Point } from 'geojson'
import type { Facility, FacilityFeature } from '../types/app'
import {
  CATEGORY_ORDER,
  categoryCode,
  categoryColor,
  categoryInk,
  categoryLabel,
} from '../lib/categories'
import { featureCoords, type Position } from '../lib/geo'
import type { ResolvedTheme } from '../lib/theme'
import {
  MAP_CHROME,
  MAP_FONT,
  MapSurface,
  SELECTED_RING,
  motion,
  useBasemap,
} from './basemap'

const SOURCE_ID = 'facilities'
const LAYER_CLUSTERS = 'facility-clusters'
const LAYER_CLUSTER_COUNT = 'facility-cluster-count'
const LAYER_HOVER = 'facility-hover'
const LAYER_SELECTED = 'facility-selected'
const LAYER_POINTS = 'facility-points'
const LAYER_CODES = 'facility-codes'

const UNCLUSTERED: ExpressionSpecification = ['!', ['has', 'point_count']]

/** `match` on category → per-category constant, with a neutral fallback. */
function categoryMatch(pick: (c: Facility['category']) => string, fallback: string) {
  return [
    'match',
    ['get', 'category'],
    ...CATEGORY_ORDER.flatMap((c) => [c, pick(c)]),
    fallback,
  ] as unknown as ExpressionSpecification
}

const COLOR_EXPR = categoryMatch(categoryColor, '#6b7280')
const INK_EXPR = categoryMatch(categoryInk, '#ffffff')
const CODE_EXPR = categoryMatch(categoryCode, '?')

/** Filter matching the one unclustered point with this id (or nothing). */
function idFilter(id: string | null): ExpressionSpecification {
  return ['all', UNCLUSTERED, ['==', ['get', 'id'], id ?? '\0']]
}

interface MarkerProps {
  id: string
  name: string
  category: Facility['category']
  designation: string
}

function toGeoJSON(features: FacilityFeature[]): FeatureCollection<Point, MarkerProps> {
  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: featureCoords(f) },
      properties: {
        id: f.properties.id,
        name: f.properties.name,
        category: f.properties.category,
        designation: f.properties.designation ?? '',
      },
    })),
  }
}

/** Hover popup body. Built as DOM (not HTML) so data can't inject markup. */
function popupContent(props: MarkerProps): HTMLElement {
  const root = document.createElement('div')
  root.className = 'text-sm leading-tight'

  const name = document.createElement('div')
  name.className = 'font-semibold text-ink'
  name.textContent = props.name
  root.append(name)

  const meta = document.createElement('div')
  meta.className = 'text-ink-muted'
  meta.textContent = [categoryLabel(props.category), props.designation]
    .filter(Boolean)
    .join(' · ')
  root.append(meta)

  return root
}

/**
 * Add the facility source and its layers to whatever style is currently loaded.
 * Called on first load *and* after every basemap swap.
 */
function installLayers(map: MapLibreMap, theme: ResolvedTheme): void {
  const chrome = MAP_CHROME[theme]

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: toGeoJSON([]),
    cluster: true,
    clusterRadius: 48,
    clusterMaxZoom: 14,
  })

  map.addLayer({
    id: LAYER_CLUSTERS,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': chrome.cluster,
      'circle-radius': ['step', ['get', 'point_count'], 16, 10, 21, 50, 27],
      'circle-stroke-width': 2,
      'circle-stroke-color': chrome.ring,
    },
  })

  map.addLayer({
    id: LAYER_CLUSTER_COUNT,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': MAP_FONT,
      'text-size': 12,
    },
    paint: { 'text-color': chrome.clusterInk },
  })

  // Hover halo and selection ring sit under the markers.
  map.addLayer({
    id: LAYER_HOVER,
    type: 'circle',
    source: SOURCE_ID,
    filter: idFilter(null),
    paint: {
      'circle-color': COLOR_EXPR,
      'circle-opacity': 0.3,
      'circle-radius': 20,
    },
  })

  map.addLayer({
    id: LAYER_SELECTED,
    type: 'circle',
    source: SOURCE_ID,
    filter: idFilter(null),
    paint: {
      'circle-color': chrome.ring,
      'circle-opacity': 0,
      'circle-radius': 17,
      'circle-stroke-width': 3,
      'circle-stroke-color': SELECTED_RING[theme],
    },
  })

  map.addLayer({
    id: LAYER_POINTS,
    type: 'circle',
    source: SOURCE_ID,
    filter: UNCLUSTERED,
    paint: {
      'circle-color': COLOR_EXPR,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 9, 14, 12],
      // A 2px surface ring keeps overlapping markers separable.
      'circle-stroke-width': 2,
      'circle-stroke-color': chrome.ring,
    },
  })

  map.addLayer({
    id: LAYER_CODES,
    type: 'symbol',
    source: SOURCE_ID,
    filter: UNCLUSTERED,
    layout: {
      'text-field': CODE_EXPR,
      'text-font': MAP_FONT,
      'text-size': 9,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': INK_EXPR },
  })
}

/** Where the map should sit. Changing `key` re-frames it. */
export interface MapCamera {
  key: string
  center: Position
  zoom: number
  bbox?: [number, number, number, number] | null
}

interface Props {
  features: FacilityFeature[]
  camera: MapCamera
  selectedId: string | null
  hoveredId: string | null
  theme: ResolvedTheme
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

export function MapView({
  features,
  camera,
  selectedId,
  hoveredId,
  theme,
  onSelect,
  onHover,
}: Props) {
  const popupRef = useRef<Popup | null>(null)

  // Map listeners are registered once; they read the latest callbacks from here.
  const handlers = useRef({ onSelect, onHover })
  useEffect(() => {
    handlers.current = { onSelect, onHover }
  }, [onSelect, onHover])

  const onCreate = useCallback((map: MapLibreMap) => {
    map.on('click', LAYER_CLUSTERS, (e) => {
      const feature = e.features?.[0]
      const clusterId = feature?.properties?.cluster_id
      if (typeof clusterId !== 'number' || feature?.geometry.type !== 'Point') return
      const center = feature.geometry.coordinates as Position
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
      source
        ?.getClusterExpansionZoom(clusterId)
        .then((zoom) => map.easeTo({ center, zoom, duration: motion(500) }))
        .catch((err) => console.error('Cluster expansion failed', err))
    })

    map.on('click', LAYER_POINTS, (e) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') handlers.current.onSelect(id)
    })

    // Clicking empty map clears the selection.
    map.on('click', (e) => {
      if (!map.getLayer(LAYER_POINTS)) return
      const hits = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_POINTS, LAYER_CLUSTERS],
      })
      if (hits.length === 0) handlers.current.onSelect(null)
    })

    map.on('mousemove', LAYER_POINTS, (e) => {
      const feature = e.features?.[0]
      if (!feature || feature.geometry.type !== 'Point') return
      map.getCanvas().style.cursor = 'pointer'
      const props = feature.properties as MarkerProps
      handlers.current.onHover(props.id)

      const popup =
        popupRef.current ??
        (popupRef.current = new Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
        }))
      popup
        .setLngLat(feature.geometry.coordinates as Position)
        .setDOMContent(popupContent(props))
        .addTo(map)
    })

    map.on('mouseleave', LAYER_POINTS, () => {
      map.getCanvas().style.cursor = ''
      handlers.current.onHover(null)
      popupRef.current?.remove()
    })

    map.on('mouseenter', LAYER_CLUSTERS, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', LAYER_CLUSTERS, () => {
      map.getCanvas().style.cursor = ''
    })

    return () => {
      popupRef.current?.remove()
      popupRef.current = null
    }
  }, [])

  const { containerRef, mapRef, ready, failed } = useBasemap({
    theme,
    center: camera.center,
    zoom: camera.zoom,
    install: installLayers,
    onCreate,
  })

  // Feed the current (filtered) feature set to the clustered source.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(toGeoJSON(features))
  }, [features, ready, mapRef])

  // Re-frame on region / sub-region change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (camera.bbox) {
      map.fitBounds(camera.bbox, { padding: 64, maxZoom: 15, duration: motion(800) })
    } else {
      map.flyTo({ center: camera.center, zoom: camera.zoom, duration: motion(800) })
    }
    // Only re-frame when the camera intent changes, not on every render.
  }, [camera.key, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setFilter(LAYER_HOVER, idFilter(hoveredId))
  }, [hoveredId, ready, mapRef])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    map.setFilter(LAYER_SELECTED, idFilter(selectedId))
  }, [selectedId, ready, mapRef])

  // Bring an off-screen selection into view (e.g. picked from the list).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !selectedId) return
    const feature = features.find((f) => f.properties.id === selectedId)
    if (!feature) return
    const center = featureCoords(feature)
    if (!map.getBounds().contains(center)) {
      map.easeTo({ center, zoom: Math.max(map.getZoom(), 13), duration: motion(600) })
    }
    // Deliberately not re-running when `features` changes — only new selections
    // should move the map.
  }, [selectedId, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapSurface
      containerRef={containerRef}
      label="Facility map"
      failed={failed}
      fallback="The facility list below still works."
    />
  )
}
