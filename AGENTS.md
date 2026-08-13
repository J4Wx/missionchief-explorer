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

Phase 0 (plan, schema, fixture) and Phase 1 (Vite/React/TS/Tailwind scaffold, validation
script + CI, schema→TS type generation, region list UI with region picker & sub-region
filter) are complete. **Phase 2** (MapLibre map + facility detail panel) is next — see
`docs/07-roadmap.md`.

Dev commands: `npm run dev` · `npm run validate` · `npm run typecheck` · `npm run lint` ·
`npm run build` (build regenerates types first). Types in `src/types/schema.ts` are
generated — run `npm run gen:types` after editing the schemas, never hand-edit them.
