# 04 — Architecture

## Overview

Dispatch Atlas is a **static single-page application** that loads **static per-region
GeoJSON** data files. There is no backend and no database at runtime: the "database" is
the versioned data in `/data`, validated in CI, and served as flat files. This keeps
hosting free/cheap, makes the whole catalog forkable, and lets the data-generation agent
contribute via ordinary pull requests.

```
                 build time                          run time (browser)
  ┌───────────────────────────────┐        ┌───────────────────────────────────┐
  │ /data/regions/*.geojson        │        │  index.json ─▶ region picker        │
  │ /schemas/*.json                │        │      │                              │
  │        │ validate (ajv, CI)     │        │      ▼                              │
  │        ▼                        │  ───▶  │  fetch region .geojson              │
  │ Vite build ─▶ dist/ (static)    │        │      │                              │
  └───────────────────────────────┘        │      ├─▶ MapLibre GL (map + clusters)│
                                            │      ├─▶ list / filters / search     │
                                            │      └─▶ facility detail panel        │
                                            └───────────────────────────────────┘
```

## Tech stack & rationale

| Concern | Choice | Why |
| --- | --- | --- |
| Language | **TypeScript** | Schema-derived types keep UI and data in lock-step. |
| Build/dev | **Vite** | Fast dev server, simple static build; devcontainer is Node 24. |
| UI | **React** | Ubiquitous, good map-library support, easy for future contributors. |
| Styling | **Tailwind CSS** | Fast, consistent styling without bespoke CSS sprawl. |
| Map | **MapLibre GL JS** | Open-source, vector tiles, built-in GeoJSON **clustering** & styling — key for dense urban data. |
| Base map tiles | **OpenFreeMap** (default, no API key) or **MapTiler** (free tier) | No/low cost; swap the style URLs via `VITE_MAP_STYLE` / `VITE_MAP_STYLE_DARK`. |
| Client search | **Fuse.js** | Lightweight fuzzy search over names/agencies/specialties. |
| Data validation | **ajv** (JSON Schema 2020-12) | Enforces the schema in `npm run validate` and CI. |
| Types from schema | **json-schema-to-typescript** | Single source of truth: types generated from `facility.schema.json`. |
| Hosting | **Cloudflare Pages / GitHub Pages / Netlify** | Static, free, PR previews. |

> These are recommendations chosen to minimize cost and moving parts. Leaflet is an
> acceptable simpler alternative to MapLibre if vector tiles/clustering aren't needed
> early; the data format (GeoJSON) is library-agnostic either way.

## Proposed repository layout

```
/
├─ README.md
├─ AGENTS.md                     # operating instructions for agents
├─ docs/                         # this planning set
├─ schemas/
│  ├─ facility.schema.json
│  └─ region.schema.json
├─ data/
│  └─ regions/
│     ├─ index.json              # region registry
│     ├─ <region_id>.geojson     # one file per region — the app's load unit
│     └─ parts/                  # regions too big to generate in one pass
│        └─ <region_id>/
│           ├─ region.json       # manifest: the region's metadata + its parts
│           └─ <part_id>.geojson # one part (a borough), merged into the above
├─ .github/
│  ├─ ISSUE_TEMPLATE/            # issue forms: region request, correction, bug, idea, schema
│  ├─ labels.yml                 # the label set, synced by scripts/sync-labels.mjs
│  └─ workflows/                 # CI, PR preview deploys, label sync
├─ scripts/
│  ├─ validate.mjs               # ajv validation of all data files
│  ├─ gen-types.mjs              # schema → src/types/schema.ts
│  ├─ new-region.mjs             # register/scaffold a region; queue batches/parts
│  ├─ merge-region.mjs           # parts/<region_id>/* → <region_id>.geojson
│  ├─ lib/{regions,merge,cli}.mjs # shared paths, registry pins, the part merge
│  └─ sync-labels.mjs            # .github/labels.yml → the repo's labels
├─ src/                          # app (added in Phase 1)
│  ├─ main.tsx
│  ├─ index.css                  # Tailwind + light/dark role tokens
│  ├─ types/schema.ts            # generated from schema
│  ├─ data/regions.ts
│  ├─ map/{MapView,Legend}.tsx
│  ├─ ui/{RegionPicker,SubregionFilter,SearchBox,FilterPanel,FacilityList,
│  │      FacilityDetail,AboutPanel,ThemeToggle}.tsx
│  └─ lib/{search,filters,categories,url,theme,geo,format,address,subregions,links}.ts
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## Data flow

1. **Load registry** — app fetches `data/regions/index.json` and renders the **global map**
   (a pin per published region, from the registry's own `center`/`facility_count`) plus the
   region picker. The landing view touches no region file, which is what keeps "never ship
   all regions at once" compatible with showing all of them.
2. **Load region** — on selection, fetch `data/regions/<region_id>.geojson`. A region
   generated in parts is no different here: the parts are a *generation* unit, merged into
   one region file at author time, so the app never learns they existed.
3. **Render** — feed the FeatureCollection to MapLibre as a **clustered** source; render
   the same features into the list/filters.
4. **Interact** — filtering by category/agency/specialty and text search operate on the
   in-memory FeatureCollection; selecting a facility opens the detail panel and flies the
   map to it. State (region, filters, selected id) is reflected in the URL for shareable
   deep links.

## Validation & CI

- `npm run validate` loads every file in `data/regions/`, validates each `Feature` against
  `facility.schema.json` and the file against `region.schema.json`, and additionally
  checks: unique `id` per file, coordinates within valid ranges, ≥1 `source` per record,
  `region_id` matching the filename, **sub-region referential integrity** (every
  `subregion_id` resolves to a declared sub-region; every sub-region `parent` resolves with
  no cycles; sub-region `id`s unique), and that each registry entry's `center` /
  `facility_count` still agree with the file it points at (the global map's pins).
- For a region generated in parts it also validates the manifest and each part file, and
  **re-runs the merge in memory**: a committed region file that no longer matches the parts
  it is made of fails the build, naming the `merge-region` command that fixes it. Parts get
  the checks that only exist because two of them are written independently — a facility in
  more than one part, a facility outside the sub-region its part covers, a part declaring a
  top-level division of its own, a part file the manifest never listed.
- `npm test` runs the Vitest suite (`vite.config.ts` → two projects: `app` in jsdom,
  `scripts` in Node). `scripts/validate.test.mjs` runs the validator itself as a
  subprocess against throwaway fixture directories — `validate.mjs` takes an optional
  regions directory argument for exactly this, defaulting to `data/regions`.
- CI (GitHub Actions) runs `validate`, `typecheck`, `lint`, `test`, and `build` on every
  PR — so agent-generated data can't merge unless it's schema-valid. See
  [06 — Data-Generation Agent](06-data-generation-agent.md).

## Performance notes

- Region files are the load unit; keep them to a metro/county scale so payloads stay small
  (target < ~1–2 MB). Splitting a metro's *generation* into parts (`data/regions/parts/`)
  does not split its payload — the parts merge into one file — so a region big enough to
  need parts is also the one to watch this budget on. `merge-region` warns past ~1.5 MB.
  Splitting the load unit too means either separate regions or the per-part lazy load in
  proposal E.
- Use MapLibre cluster layers rather than rendering thousands of individual markers.
- Lazy-load the selected region only; never ship all regions to the client at once.

## Explicitly out of scope for v1

- Server-side rendering, auth, write APIs, or a runtime database.
- Real-time data. The catalog is a curated snapshot with `last_verified` dates.
