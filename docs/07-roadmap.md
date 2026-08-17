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

## Phase 6 — International regions (schema & domain model) ✅

**Target: the UK edition** (`missionchief.co.uk`) — decided 2026-08-17. It's one of
**24 localized editions**, listed in [02 — Domain Model § Editions](02-domain-model.md#editions);
the US edition this catalog was built for is another. The UK goes first because its sources
are English (so the English UI and the agent's sourcing both stand as-is) while its services
differ from the US in every way the schema currently hard-codes — which makes it a real test
of the model rather than a cosmetic one.

The catalog is US-shaped in ways that a data PR cannot fix, so covering a region outside
the US is a **schema and domain-model** phase, not another Phase 4. What blocks it today:

| Blocker | Where |
| --- | --- |
| `address.state` is **required**; the field set is US-only | `schemas/facility.schema.json` |
| `agency.level` enum stops at `municipal/county/state/federal` | same |
| `agency.type` has `sheriff_office` but no national police, military or aid organization | same |
| `category` carries `sheriff`/`state_le`/`federal_le`/`ranger`; no civil protection, sea/mountain rescue, or national police | same |
| Trauma tags `trauma_level_1/2` encode the **ACS** system only (not UK MTC, not DGU tiers) | `docs/02` specialties |
| `subregions[].level` has `township`/`precinct` but no `ward`/`region`/`Kreis`-equivalent | `schemas/region.schema.json` |
| Address rendering assumes US order and appends the literal word "County" | `src/ui/FacilityDetail.tsx:74,130` |
| Fuzzy search doesn't fold diacritics — "Munchen" won't match "München" | `src/lib/search.ts` |
| `region_id` convention and `new-region` default assume `us-<state>-<city>` / `--country US` | `AGENTS.md`, `scripts/new-region.mjs:134` |
| `game.building_types` are implicitly US-edition building names | `docs/02`, all region files |

### Scope

**Schema (`schema_version` → 2, additive; no renames, existing files stay valid)** ✅

- [x] Dropped `state` from `address.required` (now `city` + `country`); `state` re-documented
      as the first-level administrative area (state / province / *Land* / nation) and
      `county` as the second level, rather than adding parallel fields. `country` is now
      constrained to ISO 3166-1 alpha-2 on both facilities and region metadata.
- [x] Widened `agency.level` (added `district`, `regional`, `national`) and `agency.type`
      (added `national_police`, `military`, `rescue_service`, `aid_organization`).
- [x] Widened `category` with `police_national`, `sea_rescue`, `mountain_rescue`,
      `civil_protection`, each documented in `docs/02` with the structural note on when to
      use it instead of its US-shaped sibling.
- [x] Widened `subregions[].level` (added `unitary_authority`, `ward`, `commune`, `region`,
      `province`).
- [x] Country-scoped trauma taxonomy: normalized `trauma_major`/`trauma_unit` tiers drive
      filtering, `attributes.trauma_designation` records the designation as issued
      (`{system, label}`), and the ACS-only tags stay valid on US records — the validator
      **rejects** them elsewhere.
- [x] `metadata.game_edition` (ISO-2 of the edition the `game` blocks target). The
      controlled *vocabulary* for `game.building_types` stays with proposal D in `docs/08`.
- [x] New validator rules: schema version (warn below current, fail above), `region_id`
      prefix must match `metadata.country`, cross-country facility warning, and the ACS
      guardrail. `scripts/validate.mjs` gained warnings that print without failing.
- [x] `scripts/new-region.mjs` derives the country from the `region_id` prefix instead of
      defaulting to `US`, with `--edition` for the game edition.
- [x] Migrated all three existing files to `schema_version: 2` (`game_edition: US`, trauma
      tiers on the five designated hospitals).

**Sixth service group check** ✅

- [x] All four new categories folded into existing groups — `police_national` into *Law
      enforcement*, the three rescue services into *Fire*, which is relabelled **"Fire &
      rescue"** to carry the widened meaning. **No palette change**, so the mode-invariant
      colors validated in Phase 5 stand untouched.

**App** ✅

- [x] Country-aware address rendering (`src/lib/address.ts`): a per-country convention for
      where the postal code sits — `after_region` (US/CA/AU/NZ: "Savannah, GA 31401"),
      `own_line` (GB/IE: post town, then postcode), `before_city` (the default elsewhere:
      "10115 Berlin") — plus the local word for a second-level area, so `county` reads
      "Chatham County" in the US and plain "Merseyside" in the UK. `addressLines()` returns
      lines rather than a string, because the UK form only reads correctly if the break
      survives; `FacilityDetail` renders them as blocks.
- [x] Diacritic folding in search (`src/lib/search.ts`): a `fold()` applied to both the
      query and every indexed field via Fuse's `getFn`, so "Munchen" finds "München".
      NFD strips accents; the letters that don't decompose (ß, ø, æ, œ, ł, đ, ð, þ) are
      spelled out explicitly.
- [x] About-panel copy generalized — no longer enumerates the US tiers, and says outright
      that each region is recorded the way its own country organizes its services.

**UK domain mapping (`docs/02`)** ✅ — *written up in `docs/02`; kept here as the record of
what was decided*

The UK doesn't just rename the US model, it restructures it. Each row below was a mapping
decision, none of which should be improvised by a data PR:

| Concern | US model today | UK reality to accommodate |
| --- | --- | --- |
| Country code | `US` | **`GB`**, not `UK` — ISO 3166-1 alpha-2. `region_id` prefix `gb-`. |
| First-level admin | state (required) | none. Nation (England/Scotland/Wales/NI) + county / unitary authority, often omitted from addresses entirely. |
| Postal address | `city, ST 12345` | post town then postcode on its own line; no state segment. |
| Fire | municipal fire departments | **Fire and Rescue Services** at county / metropolitan / national (Scotland, Wales) level. |
| Fire apparatus | engine / ladder / quint | pumping appliance ("pump"), aerial ladder platform, turntable ladder, rescue pump, command unit; no quint. |
| EMS | municipal or private, ALS/BLS | regional **NHS ambulance trusts**; double-crewed ambulance vs rapid-response vehicle; HART for hazardous-area work; helicopters largely **charity**-run. |
| Police | local PD + county sheriff | territorial forces (county/regional); **no sheriff equivalent**. Armed Response Vehicles rather than a standing SWAT building. |
| National LE | `state_le` + `federal_le` | national bodies with no state tier — NCA, British Transport Police, Border Force, MOD Police, Civil Nuclear Constabulary. |
| Hospital | ED, ACS trauma levels I–IV | **A&E** departments; **Major Trauma Centre / Trauma Unit** inside a major trauma network. ACS levels do not apply. |
| Corrections | county jail vs state/federal prison | **HM Prison** estate is national; the nearest "jail" analogue is a police custody suite. |
| Sea / coastal | US Coast Guard | **HM Coastguard** (rescue teams + operations centres) and the **RNLI** lifeboat stations — a charity, not a state service, so it needs its own category rather than `coast_guard`. |
| Mountain / inland | ranger stations | volunteer mountain, cave and lowland rescue teams. |
| Dispatch | consolidated 911 PSAP | 999 call handling then **per-service control rooms**; no single PSAP per area. |
| Tow | municipal impound + private | recovery operators; motorway recovery under National Highways. |

**Docs & tooling** ✅

- [x] `region_id` convention documented as `<country>-<admin>-<name>` with UK examples;
      `docs/03` gained an addresses-across-countries table, a trauma section and a schema
      version history; `docs/02` gained the editions list, the structural-category notes, a
      UK apparatus mapping and the trauma tiers.
- [x] `docs/06` gained a non-US section and a UK source table (FRS appliance pages,
      ambulance trust estates, NHS major trauma network designations, prison estate, RNLI
      directory), with the "no fabrication" bar restated for unfamiliar structures.

**Proof** ✅

- [x] **Liverpool / Merseyside published** — `gb-mersey-liverpool`, 72 facilities across the
      five metropolitan boroughs. Chosen over London for the reasons below; the boroughs are
      both the county's constituent authorities and MFRS's own area commands, so the
      sub-regions needed no judgement calls.
- [x] The schema generalized without a fudge: no `state` on any record, `GB` throughout,
      trauma recorded as Major Trauma Centre / Trauma Unit under `nhs_mtn` with the
      country-neutral tiers, the RNLI filed as `sea_rescue` (not `coast_guard`) with
      `agency.type: rescue_service`, British Transport Police as `police_national`, HM Prison
      Liverpool as a `national` prison alongside privately-run Altcourse, and St John
      Ambulance as an `aid_organization`.
- [x] Coordinates come from **ONS postcode data** (postcodes.io) wherever an official
      postcode was published, OpenStreetMap otherwise — cited per record either way. Spot
      checks agreed with OSM to ~1 m where both existed.

What the region does *not* have, recorded in its registry note rather than papered over:
HM Coastguard rescue teams, tow/recovery operators, NWAS and police vehicle allocations,
per-station fire duty systems, and The Walton Centre (the adult MTC's collaborative partner,
for which no coordinate source was found). Fire `units` are empty on all 22 stations because
MFRS publishes addresses but not appliance allocations — the single biggest depth gap, and
exactly what proposal B exists to close.

### Exit ✅

Met. Liverpool / Merseyside is published and validates with no US-shaped field fudged; the
three existing US regions still validate at `schema_version: 2`; `npm run validate`,
`typecheck`, `lint` and `build` all pass. The ACS guardrail in `validate.mjs` was confirmed
to fire against a deliberately-broken GB fixture before the real data was written.

### Decisions

1. ~~Which edition to target first~~ — **decided: UK.** The full 24-edition list is
   recorded in [02 — Domain Model § Editions](02-domain-model.md#editions), so the remaining
   22 are a known set rather than an open question.
2. **UI translation is out of scope.** This phase internationalizes the *data model* — the
   interface stays English, which the UK target doesn't strain. Translating the UI is a
   separate phase, worth it only once a non-English region is published.
3. **`schema_version` 2 is claimed by this phase.** Proposal D's controlled
   `game.building_types` vocabulary becomes version 3 unless the two are scheduled together.
4. **Still open: which UK metro.** Needs picking before the proof step (not before the
   schema work).

## Phase 7 — Test & regression foundation ✅

Promoted from **proposal A** in [08 — Phase Proposals](08-phase-proposals.md) and taken
first, because every proposal after it edits shared logic. Before this phase the repo had
**no tests**: ~3.5k lines of app code guarded only by `validate` / `typecheck` / `lint` /
`build`, none of which can see a behavioral regression. A silent break in `url.ts` would
break every shared link with CI still green.

### Scope

- [x] **Vitest** (`npm test`, `npm run test:watch`), configured in `vite.config.ts` as two
      projects: `app` (jsdom + a Testing Library setup file) and `scripts` (plain Node), so
      the script tests don't pay for jsdom or load a setup that imports React. Wired into
      `.github/workflows/ci.yml` between Lint and Build. **247 tests across 13 files.**
- [x] **Pure logic modules** — `lib/filters` (24: AND-across / OR-within, the
      closed-and-planned status default and its override, cross-filtered facet counts, a
      selected value held at count 0), `lib/url` (19: the wire format field by field,
      round-trip including values needing escaping, unknown params ignored, a clean URL for
      cleared state, no history entry), `lib/subregions` (9: subtree walking, and
      termination on the cycles `validate` rejects), `lib/geo` (10), `lib/search` (16: the
      `fold()` table and every indexed field), plus the Phase 6 modules `lib/address` (12:
      all three postcode conventions) and `lib/regionTree` (23: the collapse-a-division rule
      in both directions), and `lib/format` (17).
- [x] **Component smoke tests** (React Testing Library) for `FilterPanel` (18),
      `FacilityDetail` (19) and `FacilityList` (13) — render, plus the keyboard and focus
      behavior the Phase 5 a11y pass added: arrow-key row navigation, Escape-to-close,
      focus moving into the detail panel on open and back to its opener on close.
- [x] **The palette invariant as a test** (`src/lib/categories.test.ts`, 32). The dataviz
      skill's checker is an authoring tool that isn't installed on the runner, so its math —
      sRGB → OKLab, the Machado-Oliveira-Fernandes (2009) CVD transforms — is ported into
      `src/test/color.ts` and the gates are asserted directly: all-pairs CVD ΔE ≥ 8,
      normal-vision ΔE ≥ 15, both lightness bands, the chroma floor, ≥ 3:1 against
      `#ffffff` *and* `#0f172a`, and ≥ 4.5:1 for each badge ink on its own mark. Category
      codes are checked for uniqueness too — they are the non-color half of the encoding.
- [x] **Fixture-based test for `scripts/validate.mjs`** (35). `validate.mjs` now takes an
      optional regions directory (`node scripts/validate.mjs <dir>`, defaulting to
      `data/regions`, so `npm run validate` is unchanged); the test writes throwaway
      registries and region files to a temp dir and runs the real script as a subprocess.
      Fixtures are built by mutating a known-good base, so each case states exactly what it
      breaks. Covers the schema errors, both registry directions, filename ↔ `region_id`,
      the schema-version warn/fail split, sub-region integrity including cycles, and the
      ACS-outside-the-US guardrail — asserting on exit code *and* message, and that warnings
      print without failing.

### Dropped from the proposal

- **Playwright happy path.** Dropped on the CI-budget decision (proposal A's own cost note,
  and decision 4 in `docs/08`); the item stays open there. Nothing else in the phase
  depended on it, but note what it means: there is **no test that exercises `App.tsx`, the
  map, or a real region file end to end.** `MapView`, `RegionPicker`, `AboutPanel`,
  `SearchBox`, `SubregionFilter`, `ThemeToggle` and `data/regions.ts` are untested.

### Exit ✅

Met. `npm test` covers every pure logic module and the three interactive panels; CI runs it.
Both named regression classes were confirmed to fail the build before this was called done:
nudging the law-enforcement blue toward the corrections purple fails three palette
assertions, and renaming a facet's URL param fails the format test. (The round-trip tests
*don't* catch that rename — it is symmetric — which is why the wire format is pinned
separately.)

## Later / stretch

- Coverage-gap overlay (heatmap of under-served areas) as an in-game siting aid.
- Distance/response-time isochrones from stations.
- Cross-region search and a global region map.
- Community corrections workflow — **issue templates landed** (2026-08-17: five forms in
  `.github/ISSUE_TEMPLATE/`, the correction one deep-linked from the facility panel, labels
  as code in `.github/labels.yml`). What remains is the automation around them: request
  issues into the `index.json` queue, and correction issues into PRs.

> These are worked up — with scope, exit criteria and the measured gaps behind each — as
> lettered candidates **A–F** in [08 — Phase Proposals](08-phase-proposals.md), alongside
> proposals that aren't on this list (tests, data-depth pass, freshness/link rot, build-plan
> output). Approved proposals move here and get a phase number then.

## Success criteria

- Adding a region = "task the agent with a place name" → a validated PR.
- A player can, for a covered city, see every major facility, what runs from it, and get a
  clear "what to build" read for Mission Chief.
