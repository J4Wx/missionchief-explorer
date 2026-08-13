# 07 — Roadmap

Phased delivery. Each phase is independently shippable and leaves the repo in a working,
validated state.

## Phase 0 — Planning & data foundation ✅ (this repo)

- [x] Project plan & docs (`docs/`).
- [x] Normalized data schema (`schemas/facility.schema.json`, `region.schema.json`).
- [x] Sample/fixture region (`data/regions/example-springfield.geojson`) + `index.json`.
- [x] Agent operating contract (`docs/06`, `AGENTS.md`).

## Phase 1 — App scaffold & validation

- [ ] Scaffold Vite + React + TS + Tailwind app (`src/`, `index.html`, config).
- [ ] `scripts/validate.mjs` (ajv) + `npm run validate`; wire into CI (GitHub Actions).
- [ ] Generate TS types from `facility.schema.json`.
- [ ] Load `index.json` + a region file; render a bare list of facilities.
- **Exit:** app builds, data validates in CI, one region renders as a list.

## Phase 2 — Map & detail

- [ ] MapLibre GL map with clustered, category-colored markers + legend.
- [ ] Facility detail panel (units, specialties, attributes, `game` block, sources).
- [ ] Map ⇄ list selection sync; region picker.
- **Exit:** browse a region on the map and inspect any facility.

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
