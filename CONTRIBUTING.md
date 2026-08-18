# Contributing to Dispatch Atlas

Thanks for helping. There are three useful kinds of contribution, in rough order of
how often they're needed:

1. **Request a region** — ask for a city or county to be added.
2. **Correct the data** — fix a station, unit roster, trauma level, or closure.
3. **Improve the app** — the map, filters, and everything around them.

All three start with an issue, and there is a form for each —
[region request](https://github.com/J4Wx/missionchief-explorer/issues/new?template=01-region-request.yml),
[data correction](https://github.com/J4Wx/missionchief-explorer/issues/new?template=02-data-correction.yml),
[app bug](https://github.com/J4Wx/missionchief-explorer/issues/new?template=03-app-bug.yml),
[feature or idea](https://github.com/J4Wx/missionchief-explorer/issues/new?template=04-app-idea.yml),
and [schema or vocabulary addition](https://github.com/J4Wx/missionchief-explorer/issues/new?template=05-schema-vocabulary.yml)
(see [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE)). The forms ask for the things
we'd otherwise have to come back for — a region's agencies, a correction's source.

Agents working in this repo should read [`AGENTS.md`](AGENTS.md) first; it is the
operating contract, and this guide assumes it.

## Ground rules for data

These are non-negotiable, for humans and agents alike:

- **Never fabricate.** If a fact can't be found, it stays unknown — `null`, `[]`, or
  `confidence: low`. An invented apparatus roster is worse than an empty one.
- **Cite everything.** Every facility record carries at least one real, resolvable
  source URL in `sources[]`.
- **Public information only.** No personal data, no home addresses, no operationally
  sensitive security detail. Public facility and agency information is the whole scope.
- **Stay in schema.** Use the controlled vocabularies in
  [`schemas/facility.schema.json`](schemas/facility.schema.json). Adding a category, unit
  type, or specialty means updating the schema **and**
  [`docs/02-domain-model.md`](docs/02-domain-model.md) in the same change.

## Requesting a region

Open a [**Region request**](https://github.com/J4Wx/missionchief-explorer/issues/new?template=01-region-request.yml)
issue with the place name (city, county, or metro) and anything you know that would help
— which agencies cover it, where the interesting facilities are, what you want it for.

Queued regions live in [`data/regions/index.json`](data/regions/index.json) with a
`status`, so the backlog is visible in the app's About panel and to the generation
agent:

| status | means |
| --- | --- |
| `requested` | queued; no data file yet |
| `in_progress` | being researched |
| `published` | merged and live |

To queue one yourself:

```bash
npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY (Erie County)" --country US
```

That appends a `requested` entry to the registry. Add `--scaffold` to also write an
empty, schema-valid region file to fill in. Run `npm run new-region -- --help` for the
full flag list, and `npm run new-region -- --list` to see the current queue — including
the per-borough queue of any region being generated in parts (below).

## Generating a region

Follow [`docs/06-data-generation-agent.md`](docs/06-data-generation-agent.md) to the
letter — it covers discovery via OpenStreetMap/Overpass, enrichment from official
sources, normalization, and the quality bar per category.

The short version:

```bash
npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY (Erie County)" \
  --country US --center -78.8784,42.8864 --zoom 11 --scaffold --status in_progress
# …research and fill in data/regions/us-ny-buffalo.geojson…
npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY (Erie County)" \
  --status published --force        # re-syncs the registry's center + facility count
npm run validate
```

That second run matters: a published registry entry carries the region's `center` and
`facility_count` for its pin on the global map, and `npm run validate` fails if either has
drifted from the data file (it prints the number it expected). Re-running `new-region`
copies both back out of the file — no hand-editing.

**One region per pull request.** It keeps review tractable and the data auditable. Keep
app changes in separate PRs from data changes.

### A region too big for one pass

A metro like New York City is not one sitting's work. Those are generated **one borough at
a time** — the parts live in `data/regions/parts/<region_id>/` and merge into the single
region file the app loads, so the split is in how the data is *made*, not in what a player
sees:

```bash
# queue the region and its boroughs
npm run new-region -- --id us-ny-nyc --name "New York City, NY" \
  --admin-name "New York" --center -73.97,40.7 --zoom 10 --part-level borough \
  --parts "manhattan:Manhattan,brooklyn:Brooklyn,queens:Queens,bronx:The Bronx,staten-island:Staten Island"

# claim one, research it, then assemble
npm run new-region -- --id us-ny-nyc --part manhattan --status in_progress --scaffold
npm run merge-region -- --id us-ny-nyc
npm run validate
```

Then it's **one part per pull request**, each with its own coverage and gaps. Your PR
touches your part file, your line of the manifest, and the regenerated region file —
never another borough's data, and never the merged file by hand. `npm run validate` fails
if the merged file has drifted from the parts it claims to be made of, so re-running
`merge-region` is always the fix. The rules are in
[`docs/06`](docs/06-data-generation-agent.md#regions-generated-in-parts); the one worth
knowing up front is that facility ids must be unique across the whole region, so prefix
them per borough (`nyc-mn-e004`).

Describe in the PR what you covered, what you couldn't find, and where confidence is
low. Known gaps stated up front are far more useful than silent ones.

## Correcting data

Corrections are the most valuable contribution — real facilities close, move, and
re-equip. Open a [**Data correction**](https://github.com/J4Wx/missionchief-explorer/issues/new?template=02-data-correction.yml)
issue (no PR needed) or a PR with:

- what's wrong,
- what it should be,
- **a source** — an agency page, a news report, an open-data record.

A citation is the only real requirement. Update the record's `sources[]`,
`confidence`, and `last_verified` along with the fix.

Every facility panel in the app has its own **Report a correction** link, which opens the
form with that region and facility already filled in — usually the fastest route.

### Asking for a region to be looked at again

A published region is a *first* pass, not a finished one — plenty of stations still have no
apparatus listed, and every record ages. **Request a review** opens an issue asking for a
**depth pass** over a whole region; the link is on every region in the About panel, and on
the "could use a look" list the app shows when no region is open. You don't need to know
what's missing — "it's the oldest region and nobody has been back" is reason enough.

Nothing is re-generated on a schedule. A region is revisited because someone asked, and a
person reviews the diff before it merges (`docs/06` § Depth passes). `npm run report --
--stale` is the same queue in numbers, and a thin region is never "fixed" by deleting
records: data only ever gets added or corrected, with a source.

## Working on the app

```bash
npm install
npm run dev        # dev server
npm run validate   # region data vs. the JSON Schemas + integrity rules
npm run typecheck
npm run lint
npm test           # Vitest — app logic, UI panels, and the data validator
npm run build      # regenerates types, then builds
npm run report     # coverage per region; `-- --stale` ranks what to deepen next
```

All five checks run in CI (`.github/workflows/ci.yml`) and must pass. `npm run report`
also runs there, but only ever as a comment on the job summary: coverage numbers are
advisory and never fail a build. Every pull
request also gets an ephemeral preview deploy — see
[`docs/forge-preview-deploys.md`](docs/forge-preview-deploys.md).

A few conventions that aren't obvious from the code:

- **Types are generated.** `src/types/schema.ts` comes from the JSON Schemas via
  `npm run gen:types`. Never hand-edit it; edit the schema.
- **Category colors are computed, not chosen.** The five service-group colors in
  `src/lib/categories.ts` are validated on the all-pairs pairlist in both themes.
  `src/lib/categories.test.ts` enforces that in CI (the same math as the **dataviz**
  skill's `validate_palette.js`, ported into `src/test/color.ts`), so a change that
  collapses two groups fails the build rather than needing you to remember the checker.
  Color always carries the *group*; the per-category code badge carries identity, so
  nothing depends on color alone.
- **Tests live next to what they test** — `src/lib/*.test.ts`, `src/ui/*.test.tsx`,
  `scripts/validate.test.mjs` — with shared fixtures in `src/test/`. `vite.config.ts`
  splits them into two Vitest projects: `app` (jsdom) and `scripts` (Node).
- **UI chrome uses role tokens.** Write `bg-surface` / `text-ink` / `border-hairline`
  (defined in `src/index.css`), not raw palette classes, so both themes stay in step.
- **Data is the single source of truth in `/data`.** It's bundled at build time via
  `import.meta.glob`; there is no backend and no runtime fetch of region files.
- **One basemap, two maps.** `src/map/basemap.tsx` owns MapLibre construction, the
  per-theme style swap and the no-basemap notice for both the global map and the facility
  map. A new map layer goes in an `install` callback handed to `useBasemap`, not in a
  second hand-rolled map.
- **Labels are code.** [`.github/labels.yml`](.github/labels.yml) defines the label set;
  `.github/workflows/labels.yml` syncs it on merge to `main`, and
  `npm run labels -- --dry-run` previews a change. Issue forms apply labels *by name* and
  GitHub silently drops any that don't exist, so a new label goes in that file first.
- **Coverage numbers never gate anything.** `npm run report` measures depth and review age
  (`scripts/lib/coverage.mjs`), and CI publishes it — but no threshold blocks a merge, hides
  a record, or justifies dropping one. `npm run validate` (schema-valid, sourced) is the
  only hard gate on data.
- **Project links live in `src/lib/links.ts`.** `REPO_URL` (overridable with
  `VITE_REPO_URL`) and the issue-form helpers — including the prefilled correction link on
  every facility panel — so a fork changes one file.

## Scope

Dispatch Atlas describes the **real world** and maps it onto Mission Chief planning. It
is an unofficial fan project with no affiliation to the game or its publisher. Requests
to model in-game mechanics, store player accounts, or track anything about real
individuals are out of scope — see [`docs/01-vision-and-scope.md`](docs/01-vision-and-scope.md).
