# 07 — Roadmap

Phased delivery. Each phase is independently shippable and leaves the repo in a working,
validated state.

## Phase 0 — Planning & data foundation ✅ (this repo)

- [x] Project plan & docs (`docs/`).
- [x] Normalized data schema (`schemas/facility.schema.json`, `region.schema.json`).
- [x] Sample/fixture region (`data/regions/example-springfield.geojson`) + `index.json`.
- [x] Agent operating contract (`docs/06`, `AGENTS.md`).

## Phase 1 — App scaffold & validation ✅

- [x] Scaffold Vite + React + TS + Tailwind app (`src/`, `index.html`, config).
- [x] `scripts/validate.mjs` (ajv + integrity rules) + `npm run validate`; wired into CI
      (`.github/workflows/ci.yml`).
- [x] Generate TS types from the schema (`scripts/gen-types.mjs` → `src/types/schema.ts`).
- [x] Load `index.json` + a region file (via `import.meta.glob`, lazy per region); render a
      list of facilities with a working region picker and sub-region filter.
- **Exit:** ✅ app builds, `validate`/`typecheck`/`lint`/`build` all pass and run in CI, the
  example region renders as a list.

## Phase 2 — Map & detail ✅

- [x] MapLibre GL map with clustered, category-colored markers + legend
      (`src/map/MapView.tsx`, `src/map/Legend.tsx`).
- [x] Facility detail panel (units, specialties, attributes, `game` block, sources)
      (`src/ui/FacilityDetail.tsx`).
- [x] Map ⇄ list selection/hover sync; region picker recenters the map, sub-region
      selection flies to its `center`/`bbox`.
- **Exit:** ✅ browse a region on the map and inspect any facility.

## Phase 3 — Filtering, search & sharing ✅

- [x] Category/agency/specialty/staffing/status filters with counts
      (`src/lib/filters.ts`, `src/ui/FilterPanel.tsx`). Facets AND across
      dimensions, OR within; empty = no constraint (except status, which hides
      closed/planned by default), so the cleared view has a clean URL. Facet
      options are cross-filtered by the current selection, so choices ruled out
      by the rest of the filters drop away.
- [x] Fuse.js fuzzy search over name/agency/designation/specialties/subtype
      (`src/lib/search.ts`, `src/ui/SearchBox.tsx`).
- [x] URL-encoded region/sub-region/filter/search/selection state via
      `replaceState` (`src/lib/url.ts`); deep links open the shared view.
- **Exit:** ✅ a player can slice the data to answer planning questions and share
  the view.

## Phase 4 — First real region via the agent ✅

- [x] Run the data-generation agent on one real city end-to-end
      (Savannah, GA / Chatham County).
- [x] Review + merge the region PR (#4); verify it renders and validates
      (`data/regions/us-ga-savannah.geojson`, listed in `index.json`).
- **Exit:** ✅ one real, well-sourced region published.

## Phase 5 — Polish & scale ✅

- [x] Accessibility/theming pass. Light/dark themes on CSS role tokens
      (`src/index.css`) driven by a `data-theme` attribute, with a three-way
      light/system/dark control (`src/ui/ThemeToggle.tsx`, `src/lib/theme.ts`),
      no-flash boot script, and a per-theme basemap style. The five service-group
      colors were **re-picked** as a mode-invariant palette that clears every
      dataviz gate on the all-pairs pairlist in *both* themes — worst CVD ΔE 9.1,
      worst normal-vision ΔE 16.5, no contrast relief (`src/lib/categories.ts`).
      Plus skip link, focus-visible ring, focus management on the detail/About
      panels, and `prefers-reduced-motion` on camera moves.
- [x] `scripts/new-region.mjs` (`npm run new-region`) registers a region,
      optionally scaffolds a schema-valid empty file, and queues batches from a
      JSON list; `index.json` carries `requested | in_progress | published`, and
      `validate.mjs` now checks the registry in both directions.
- [x] About/data-provenance panel (`src/ui/AboutPanel.tsx`, deep-linkable via
      `?about=1`) — sources, confidence model, coverage/queue, per-region
      provenance, attribution; plus `CONTRIBUTING.md`.
- [x] Deploy with per-PR previews — GitHub Actions provisions and tears down an
      ephemeral Laravel Forge site per PR (`.github/workflows/forge-pr-preview.yml`,
      `forge-pr-teardown.yml`, `docs/forge-preview-deploys.md`).
- **Exit:** ✅ publicly usable; adding regions is routine.

## Later / stretch

- Coverage-gap overlay (heatmap of under-served areas) as an in-game siting aid.
- Distance/response-time isochrones from stations.
- Cross-region search and a global region map.
- Community corrections workflow (issue templates → PRs).

## Success criteria

- Adding a region = "task the agent with a place name" → a validated PR.
- A player can, for a covered city, see every major facility, what runs from it, and get a
  clear "what to build" read for Mission Chief.
