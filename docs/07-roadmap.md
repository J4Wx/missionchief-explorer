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

## Phase 3 — Filtering, search & sharing

- [ ] Category/agency/specialty/staffing/status filters with counts.
- [ ] Fuse.js fuzzy search.
- [ ] URL-encoded region/filter/selection state (deep links).
- **Exit:** a player can slice the data to answer planning questions and share the view.

## Phase 4 — First real region via the agent

- [ ] Run the data-generation agent on one real city end-to-end.
- [ ] Review + merge the region PR; verify it renders and validates.
- **Exit:** one real, well-sourced region published.

## Phase 5 — Polish & scale

- [ ] Accessibility/theming pass (light/dark, color-vision-safe categories).
- [ ] `new-region.mjs` scaffold helper + batch region requests via `index.json`.
- [ ] About/data-provenance page; contribution guide.
- [ ] Deploy to static host with PR previews.
- **Exit:** publicly usable; adding regions is routine.

## Later / stretch

- Coverage-gap overlay (heatmap of under-served areas) as an in-game siting aid.
- Distance/response-time isochrones from stations.
- Cross-region search and a global region map.
- Community corrections workflow (issue templates → PRs).

## Success criteria

- Adding a region = "task the agent with a place name" → a validated PR.
- A player can, for a covered city, see every major facility, what runs from it, and get a
  clear "what to build" read for Mission Chief.
