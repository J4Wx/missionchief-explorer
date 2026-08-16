# AGENTS.md

Operating instructions for AI agents working in this repository. Humans: see
[`README.md`](README.md) and [`docs/`](docs/).

## What this project is

**Dispatch Atlas** — a static, map-first web explorer of real-world emergency-services
facilities (fire, EMS, police, sheriff, state/federal LE, hospitals, prisons/jails, tow,
dispatch) to help players plan builds in the game **Mission Chief**. Data is normalized
GeoJSON, one file per region, grown on demand by an agent. Read the docs before changing
anything structural:

- Vision → `docs/01-vision-and-scope.md`
- Domain model & Mission Chief mapping → `docs/02-domain-model.md`
- **Data schema (read before touching data)** → `docs/03-data-schema.md`
- Architecture & stack → `docs/04-architecture.md`
- Frontend/UX → `docs/05-frontend-ux.md`
- **Data-generation contract (read before generating data)** → `docs/06-data-generation-agent.md`
- Roadmap → `docs/07-roadmap.md`

## Two kinds of work

### 1. Building the app
- Stack: **Vite + React + TypeScript + Tailwind + MapLibre GL**, static build, no backend.
- Follow the repo layout and phase plan in `docs/04` and `docs/07`.
- Derive TypeScript types from `schemas/facility.schema.json` — don't hand-maintain a
  parallel type.
- Keep the data format library-agnostic; the app consumes GeoJSON as-is.

### 2. Generating region data
- Follow `docs/06-data-generation-agent.md` to the letter.
- Output: `data/regions/<region_id>.geojson` (valid per `schemas/region.schema.json`) +
  an `index.json` entry.
- **Never fabricate.** Every record cites ≥1 real source; unknowns stay unknown
  (`null` / `[]` / `confidence: low`). Public data only; no personal or operationally
  sensitive info.
- Use the controlled vocabularies in the schema. To add a category/unit/specialty, update
  the schema **and** `docs/02` in the same change.

## Non-negotiables

- **Validate before finishing:** `npm run validate` (once implemented) must pass. Data
  that isn't schema-valid does not merge.
- **Cite everything** in data records.
- **No secrets, no PII, public sources only.**
- **Additive schema changes:** bump `schema_version`, keep validation backward compatible.
- **The `example-springfield.geojson` fixture is FICTIONAL** — a schema demo, not real
  data. Don't cite it as a source or treat it as ground truth.

## Conventions

- IDs: lowercase kebab-case; `region_id` = `us-<state>-<city>` (or `<country>-<admin>-<name>`).
- Coordinates: GeoJSON `[lng, lat]`, WGS84, ~5 decimals.
- Dates: ISO 8601.
- Commit/PR scope: one region per data PR; keep app changes separate from data changes.

## Current state

**Phases 0–5 are complete** — see `docs/07-roadmap.md`. The app scaffold, validation +
CI, map/legend/detail, filters/search/URL state, the first real region (Savannah, GA),
PR preview deploys, light/dark theming, the About/provenance panel and the
`new-region` helper are all in. Remaining work is the "Later / stretch" list.

Dev commands: `npm run dev` · `npm run validate` · `npm run typecheck` · `npm run lint` ·
`npm run build` (build regenerates types first) · `npm run new-region -- --help`.
Types in `src/types/schema.ts` are generated — run `npm run gen:types` after editing the
schemas, never hand-edit them.

Env: `VITE_MAP_STYLE` / `VITE_MAP_STYLE_DARK` (basemap per theme; default OpenFreeMap
Liberty/Dark, no API key), `VITE_REPO_URL` (links in the About panel), `BASE_PATH`.

### Two things that are computed, not chosen

- **Service-group colors** (`src/lib/categories.ts`). Marker/legend color encodes the
  service group, with a per-category code badge as the non-color half of the encoding.
  The five colors are one **mode-invariant** set validated with the **dataviz** skill's
  `validate_palette.js` on the `--pairs all` pairlist against *both* surfaces. Changing
  one means re-running the checker in both modes — don't eyeball it, and don't add a
  sixth group without re-deriving the set.
- **UI chrome** uses the role tokens in `src/index.css` (`bg-surface`, `text-ink`,
  `border-hairline`, `text-accent`, …), never raw Tailwind palette classes — that is
  what keeps both themes in step. Every ink level clears 4.5:1 on every surface it can
  sit on. Adding a token means checking its contrast in both themes.

### Region registry

`data/regions/index.json` is both the published list and the **request queue**:
`status: requested | in_progress | published`. Queued entries have no `file` until one
exists. Use `npm run new-region` rather than hand-editing it; `npm run validate` checks
the registry against the files in both directions.
