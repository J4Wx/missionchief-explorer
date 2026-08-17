# Contributing to Dispatch Atlas

Thanks for helping. There are three useful kinds of contribution, in rough order of
how often they're needed:

1. **Request a region** — ask for a city or county to be added.
2. **Correct the data** — fix a station, unit roster, trauma level, or closure.
3. **Improve the app** — the map, filters, and everything around them.

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
- **`example-springfield.geojson` is fictional.** It demonstrates the schema. Never cite
  it, never copy numbers out of it.

## Requesting a region

Open an issue with the place name (city, county, or metro) and anything you know that
would help — which agencies cover it, where the interesting facilities are, what you
want it for.

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
full flag list, and `npm run new-region -- --list` to see the current queue.

## Generating a region

Follow [`docs/06-data-generation-agent.md`](docs/06-data-generation-agent.md) to the
letter — it covers discovery via OpenStreetMap/Overpass, enrichment from official
sources, normalization, and the quality bar per category.

The short version:

```bash
npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY (Erie County)" \
  --country US --center -78.8784,42.8864 --zoom 11 --scaffold --status in_progress
# …research and fill in data/regions/us-ny-buffalo.geojson…
npm run validate
```

**One region per pull request.** It keeps review tractable and the data auditable. Keep
app changes in separate PRs from data changes.

Describe in the PR what you covered, what you couldn't find, and where confidence is
low. Known gaps stated up front are far more useful than silent ones.

## Correcting data

Corrections are the most valuable contribution — real facilities close, move, and
re-equip. Open an issue or a PR with:

- what's wrong,
- what it should be,
- **a source** — an agency page, a news report, an open-data record.

A citation is the only real requirement. Update the record's `sources[]`,
`confidence`, and `last_verified` along with the fix.

## Working on the app

```bash
npm install
npm run dev        # dev server
npm run validate   # region data vs. the JSON Schemas + integrity rules
npm run typecheck
npm run lint
npm test           # Vitest — app logic, UI panels, and the data validator
npm run build      # regenerates types, then builds
```

All five checks run in CI (`.github/workflows/ci.yml`) and must pass. Every pull
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

## Scope

Dispatch Atlas describes the **real world** and maps it onto Mission Chief planning. It
is an unofficial fan project with no affiliation to the game or its publisher. Requests
to model in-game mechanics, store player accounts, or track anything about real
individuals are out of scope — see [`docs/01-vision-and-scope.md`](docs/01-vision-and-scope.md).
