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
- Proposed next phases (not yet approved) → `docs/08-phase-proposals.md`

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
- A region too big for one pass is generated **one part at a time** into
  `data/regions/parts/<region_id>/`, merged by `npm run merge-region` — see the registry
  section below and `docs/06 § Regions generated in parts`.
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

- IDs: lowercase kebab-case, and facility ids are unique across a whole region — which
  includes every part of one generated in parts, so prefix them per part (`nyc-mn-e004`).
  `region_id` = `<country>-<admin>-<name>`, where `<country>` is
  the **ISO 3166-1 alpha-2** code, lowercased (`us-ga-savannah`, `gb-mersey-liverpool`).
  `npm run validate` fails if the prefix disagrees with `metadata.country`.
- Coordinates: GeoJSON `[lng, lat]`, WGS84, ~5 decimals.
- Dates: ISO 8601.
- Commit/PR scope: one region per data PR — or one *part* per PR for a region generated in
  parts; keep app changes separate from data changes.

## Current state

**Phases 0–5 are complete** — see `docs/07-roadmap.md`. The app scaffold, validation +
CI, map/legend/detail, filters/search/URL state, the first real region (Savannah, GA),
PR preview deploys, light/dark theming, the About/provenance panel and the
`new-region` helper are all in. Five real regions are published (Savannah GA, Charleston SC,
Buffalo NY, Liverpool GB, Norwich GB) plus the fictional fixture.

**Phase 6 — international regions is complete** (`docs/07`). `schema_version` is now 2
(`address.state` optional, ISO-2 country codes, widened category/agency/sub-region
vocabularies, `metadata.game_edition`, country-neutral trauma tiers), addresses render per
country (`src/lib/address.ts`), search folds diacritics, and **Liverpool / Merseyside**
(`gb-mersey-liverpool`, 72 facilities) is published as the first non-US region.
**Norwich / Norfolk** (`gb-norfolk-norwich`, 109 facilities across the seven Norfolk districts)
followed as routine region growth, not a new phase.

**Buffalo, NY (Erie County)** (`us-ny-buffalo`, 191 facilities) followed as routine growth. It
is the first **volunteer-dominant** region and the first to use `township` sub-regions: the
county's own 3 cities / 25 towns / 16 villages, with `subregion_id` assigned by
point-in-polygon against OSM `admin_level` 7/8 boundary relations rather than by eye. Working
on further US counties of that shape: the towns are the division that matters, villages nest
inside them, and a village and its town needing distinct slugs (`lancaster-village` /
`lancaster-town`) is normal.

Working on non-US data: don't invent a `state` value, file an RNLI lifeboat station as
`coast_guard`, or assert an ACS trauma level for a Major Trauma Centre — `npm run validate`
rejects the last one outright. The country code is **`GB`**, not `UK`. For UK coordinates,
prefer ONS postcode data (`https://api.postcodes.io/postcodes/<postcode>`) over guessing an
OSM element match; it also returns the `admin_district`, which is the borough.

Remaining work is the lettered proposals in `docs/08-phase-proposals.md` — **proposals, not
commitments**; don't start one without it being moved into `docs/07`.

The other worked-up candidate phases live in `docs/08-phase-proposals.md` and are
**proposals, not commitments** — don't start one without it being moved into `docs/07`.

**Global map landed** (2026-08-17, part of proposal E, ahead of the phase): the app opens on
a map of every published region (`src/map/GlobalMap.tsx`) beside a coverage list
(`src/ui/RegionBrowser.tsx`), plotted from `index.json` alone; the app title returns to it.
No `?region` in the URL *is* that view. The MapLibre plumbing both maps share — construction,
per-theme style swap, motion, the no-basemap notice — is `src/map/basemap.tsx`; add layers by
handing `useBasemap` an `install` callback, never by building a second map by hand.

**Part-generated regions landed** (2026-08-18, outside a phase): a region too big for one
agent run is now generated a borough at a time under `data/regions/parts/<region_id>/` and
merged into the ordinary region file by `npm run merge-region` (`scripts/lib/merge.mjs`,
`schemas/region-{manifest,part}.schema.json`). Nothing about the app or the data schema
changed — the merged file is an ordinary region file, and the merge is checked by
`npm run validate`. See the registry section below. Nothing uses it yet: the first
candidate is NYC, and queueing it is a data decision, not a tooling one.

**Contribution intake landed** (2026-08-17, part of proposal C, ahead of the phase):
`.github/ISSUE_TEMPLATE/` holds five issue forms — region request, data correction, app
bug, feature/idea, schema/vocabulary addition. The correction form is deep-linked from
`FacilityDetail` with region + facility prefilled (`src/lib/links.ts`). Labels are code in
`.github/labels.yml`, synced by `scripts/sync-labels.mjs` (`npm run labels`) from
`.github/workflows/labels.yml` — add a label *there* before a form references it, because
GitHub drops names it doesn't recognize. The rest of C (link checking, staleness,
request-issue → queue automation) is still a proposal.

Dev commands: `npm run dev` · `npm run validate` · `npm run typecheck` · `npm run lint` ·
`npm test` · `npm run build` (build regenerates types first) ·
`npm run new-region -- --help` · `npm run merge-region -- --help` ·
`npm run labels -- --dry-run`.
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

### Regions generated in parts

A region too big for one agent run (NYC and its five boroughs is the motivating case) is
generated a part at a time under `data/regions/parts/<region_id>/`: `region.json` — the
manifest, which owns the region's `metadata` including its sub-region list, and queues the
parts with the same `requested | in_progress | published` statuses — plus one
`<part_id>.geojson` per part, holding facilities and nothing else. `npm run merge-region`
assembles them into the ordinary `data/regions/<region_id>.geojson` the app loads. The
split is in the *generation*; there is still one region, one registry entry, one file.

What this buys is parallel work, so the rules that make parallel work safe are enforced by
`npm run validate`, not left to reviewers:

- The merged file is regenerated, never hand-edited. Validation re-runs the merge and
  fails on any drift, naming the command that fixes it. On a git conflict in that file,
  take either side and re-merge.
- A facility belongs to exactly one part, and must sit in the sub-region its part covers.
  Facilities that serve the whole region (agency HQs, federal offices) go in a part with
  no `subregion_id`, not in whichever borough they happen to stand in.
- A part may nest sub-regions inside its own via `parent`, but top-level divisions belong
  to the manifest — one PR at a time owns that.
- One part per PR, each stating its own coverage and gaps. Don't touch another part's file.

Claim a part with `npm run new-region -- --id <region_id> --part <part_id> --scaffold`;
`--list` shows the parts under their region. Full contract: `docs/06`.

Entries also carry `admin` + `admin_name` (`"ga"` / `"Georgia"`, `"mersey"` /
`"Merseyside"`) — the division level of the region picker's country → division → region
tree (`src/lib/regionTree.ts`, docs/05). `admin` is the middle segment of the `region_id`
and the validator fails a disagreement; `admin_name` is the label, and its absence is a
warning, not an error. `new-region` derives the code and takes `--admin-name`.

Published entries also carry `center` and `facility_count` — the region's pin on the
**global map** (docs/05). They duplicate the region file so the landing view can plot every
region without downloading any (docs/04's "never ship all regions at once"), and
`npm run validate` compares both against the file: **add facilities and the count must move
with them**, or the build fails with the number it expected. Don't hand-edit them —
re-running `npm run new-region -- --id <id> --name "…" --force` copies both out of the data
file.
