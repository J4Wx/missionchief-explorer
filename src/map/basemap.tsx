// The MapLibre plumbing both of the app's maps sit on: the global map of
// regions (`GlobalMap`) and the facility map within one (`MapView`).
//
// Everything here is about the *basemap* — creating the map, swapping its style
// when the theme changes, and the motion and failure rules that go with it.
// What each map draws on top of it is its own business, handed in as `install`.
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
// maplibre-gl loads its worker by resolving './maplibre-gl-worker.mjs' against
// its own import.meta.url. Once a bundler has moved the library (Vite's dep
// cache in dev, a hashed chunk in the build) that path points at a file that
// isn't there, and the map dies on a 404. Hand it a URL the bundler emits
// instead — ?worker&url makes Vite bundle the worker's own imports too.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Position } from '../lib/geo'
import type { ResolvedTheme } from '../lib/theme'

setWorkerUrl(maplibreWorkerUrl)

// Vector basemap, one style per theme. OpenFreeMap needs no API key; swap for
// MapTiler/anything else with a style URL via VITE_MAP_STYLE / _DARK (docs/04).
export const STYLE_URL: Record<ResolvedTheme, string> = {
  light:
    (import.meta.env.VITE_MAP_STYLE as string | undefined) ??
    'https://tiles.openfreemap.org/styles/liberty',
  dark:
    (import.meta.env.VITE_MAP_STYLE_DARK as string | undefined) ??
    'https://tiles.openfreemap.org/styles/dark',
}

// Font stack for map labels — must exist in the style's glyph set. The dark
// OpenFreeMap style only *uses* the regular weight, but its glyph endpoint
// serves both; Regular is listed as the fallback for third-party styles.
export const MAP_FONT = ['Noto Sans Bold', 'Noto Sans Regular']

/**
 * Marker chrome per theme. The service-group fills themselves are
 * theme-invariant (src/lib/categories.ts); what has to flip is the ring and the
 * bubble that separate them from the basemap underneath. Region pins on the
 * global map reuse the bubble: at that zoom a region *is* a cluster.
 */
export const MAP_CHROME: Record<
  ResolvedTheme,
  { ring: string; cluster: string; clusterInk: string }
> = {
  light: { ring: '#ffffff', cluster: '#334155', clusterInk: '#ffffff' },
  dark: { ring: '#0f172a', cluster: '#cbd5e1', clusterInk: '#0f172a' },
}

/** Selection/emphasis ring — a neutral that reads against either basemap. */
export const SELECTED_RING: Record<ResolvedTheme, string> = {
  light: '#0f172a',
  dark: '#f8fafc',
}

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Camera-move duration, zeroed when the user asks for reduced motion. */
export const motion = (ms: number) => (prefersReducedMotion() ? 0 : ms)

interface BasemapOptions {
  theme: ResolvedTheme
  /** Where the map opens. Read once, on mount; move it afterwards with the map. */
  center: Position
  zoom: number
  /**
   * Add the map's own sources and layers to whatever style is loaded. Called on
   * first load *and* after every basemap swap — `setStyle` discards everything
   * the app added, so the layer stack has to be rebuilt from scratch.
   */
  install: (map: MapLibreMap, theme: ResolvedTheme) => void
  /**
   * Wire up the map's event listeners. Called once, on the new map; anything it
   * returns runs on teardown, before the map itself is removed.
   */
  onCreate?: (map: MapLibreMap) => void | (() => void)
}

interface Basemap {
  containerRef: RefObject<HTMLDivElement>
  mapRef: MutableRefObject<MapLibreMap | null>
  /** The map exists and its layers are installed — the cue to feed it data. */
  ready: boolean
  /** The style never loaded, so there is no basemap to draw on. */
  failed: boolean
}

/**
 * Create a MapLibre map in a container of the caller's choosing, keep its
 * basemap in step with the theme, and report when its layers are ready.
 *
 * `ready` flips off and back on across a style swap, which is what re-runs the
 * caller's data and filter effects and so restores everything it had drawn.
 */
export function useBasemap({ theme, center, zoom, install, onCreate }: BasemapOptions): Basemap {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  // The mount effect runs once; these keep it reading the current callbacks
  // (and the mount-time camera) without taking them as dependencies.
  const callbacks = useRef({ install, onCreate })
  useEffect(() => {
    callbacks.current = { install, onCreate }
  }, [install, onCreate])
  const initial = useRef({ center, zoom })

  // Which theme's style is on the map. A ref, not state, so the mount effect
  // never re-runs on a theme change — that would tear the whole map down
  // instead of swapping its basemap. Seeded with the mount-time theme, which is
  // also the style the constructor loads.
  const appliedTheme = useRef(theme)
  const swapToken = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = new MapLibreMap({
      container,
      style: STYLE_URL[appliedTheme.current],
      center: initial.current.center,
      zoom: initial.current.zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new ScaleControl())

    let loaded = false
    map.on('error', (e) => {
      console.error('MapLibre error', e.error)
      // Errors before the style loads mean no basemap at all — tell the user
      // rather than leaving a blank rectangle. Later tile hiccups are noise.
      if (!loaded) setFailed(true)
    })

    map.on('load', () => {
      loaded = true
      setFailed(false)
      callbacks.current.install(map, appliedTheme.current)
      setReady(true)
    })

    const teardown = callbacks.current.onCreate?.(map)

    return () => {
      teardown?.()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  // Swap the basemap when the theme changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    // Re-entered whenever `ready` flips (including by this effect itself); the
    // applied-style ref is what makes the swap idempotent. It also covers a
    // theme change during the initial load, which lands here once ready flips.
    if (appliedTheme.current === theme) return
    appliedTheme.current = theme

    // Superseded-swap guard. It can't be a cleanup-scoped flag: `setReady(false)`
    // below changes this effect's own dependency, so the cleanup would run —
    // and cancel the swap — before the style ever finished loading.
    const token = ++swapToken.current
    setReady(false)
    map.setStyle(STYLE_URL[theme])
    // `style.load` — not `styledata`, which also fires mid-transition, when
    // re-adding the layers would only get them wiped by the incoming style.
    map.once('style.load', () => {
      // Skip if a newer swap started, or the map was torn down meanwhile.
      if (swapToken.current !== token || mapRef.current !== map) return
      callbacks.current.install(map, theme)
      setReady(true)
    })
  }, [theme, ready])

  return { containerRef, mapRef, ready, failed }
}

interface SurfaceProps {
  containerRef: RefObject<HTMLDivElement>
  /** Accessible name for the canvas — what this map is of. */
  label: string
  failed: boolean
  /** What still works without a basemap, so the failure isn't a dead end. */
  fallback: string
  children?: ReactNode
}

/** The map canvas and its no-basemap notice. */
export function MapSurface({ containerRef, label, failed, fallback, children }: SurfaceProps) {
  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label={label} />
      {failed && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 m-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow dark:bg-amber-950 dark:text-amber-100"
        >
          The basemap couldn&apos;t be loaded. {fallback}
        </div>
      )}
      {children}
    </div>
  )
}
