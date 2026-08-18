# 06 — Data-Generation Agent

This is the operating contract for the agent that turns **"a player is interested in
`<city/region>`"** into a **schema-valid region GeoJSON file** committed to `data/regions/`.

## Objective

Given a place (e.g. "Savannah, GA" or "King County, WA"), produce a normalized,
well-sourced catalog of its emergency-services facilities per the
[Data Schema](03-data-schema.md) and [Domain Model](02-domain-model.md), suitable for
Mission Chief planning.

## Inputs & output contract

- **Input:** a region name (and optionally a bounding box or focus categories).
- **Output:**
  1. `data/regions/<region_id>.geojson` — a valid region `FeatureCollection`.
  2. An updated entry in `data/regions/index.json`.
  3. A short PR description summarizing coverage, sources, and confidence.
- **Definition of done:** `npm run validate` passes, every record cites ≥1 source, and
  coverage of core categories (fire, ems, police/sheriff, hospital, jail) is at least
  attempted with gaps noted.

## Recommended workflow

1. **Resolve the region & its sub-regions.** Establish the place, its county/state, and a
   bounding box. Assign `region_id` = `us-<state>-<city>` (or `<country>-<admin>-<name>`).
   Decide the natural **local division** and declare it in `metadata.subregions`:
   - NYC → the five **boroughs**; a **county** → its **municipalities/townships**; a
     **city** → **districts/neighborhoods** (or police precincts).
   - Give each a stable `id`, `name`, `level`, and (where known) `center`/`zoom`/`bbox`.
   - Skip sub-regions only for genuinely small regions where narrowing adds no value.
   - If the region is too big to research in one pass, this is also the division it gets
     **generated** in — see [Regions generated in parts](#regions-generated-in-parts)
     before starting, because the choice is hard to change later.
2. **Seed from OpenStreetMap (primary discovery source).** Query the Overpass API for
   emergency-services features in the bounding box (see queries below). OSM gives you
   locations, names, and often operator/agency tags for the bulk of facilities.
3. **Enrich per facility.** For each candidate, gather the planning-relevant detail the
   game cares about — apparatus/units, specialties, hospital trauma level, jail capacity,
   SWAT/K9 presence — from:
   - Official department/agency websites (station & apparatus pages).
   - Government open-data portals (fire station GIS layers, hospital licensing data).
   - Wikipedia / Wikidata (trauma centers, prisons, agencies).
   - Reputable enthusiast sources (firehouse/apparatus registries) — as `medium`/`low`
     confidence, always cited.
4. **Normalize** each into a Facility record: pick `category`/`subtype`, assign its
   `subregion_id` (the borough/district it physically sits in — use coordinates + the
   sub-region bounds/known boundaries), map units to the controlled vocabulary, tag
   `specialties`, fill `attributes`, and write the `game` block and `significance`.
5. **Cite & score.** Attach `sources[]`, set `confidence`, and `last_verified`.
6. **Assemble** the `FeatureCollection` with `metadata`, and update `index.json`.
7. **Validate** with `npm run validate`; fix all errors.
8. **Open a PR** describing coverage and known gaps.

## OpenStreetMap / Overpass discovery

Overpass QL sketch (replace `{{bbox}}` with `south,west,north,east`):

```overpassql
[out:json][timeout:60];
(
  nwr["amenity"="fire_station"]({{bbox}});
  nwr["emergency"="ambulance_station"]({{bbox}});
  nwr["amenity"="police"]({{bbox}});
  nwr["amenity"="hospital"]({{bbox}});
  nwr["amenity"="clinic"]({{bbox}});
  nwr["amenity"="prison"]({{bbox}});
  nwr["amenity"="townhall"]["office"="government"]({{bbox}}); // dispatch/EOC candidates
);
out center tags;
```

Useful OSM tags to read: `name`, `operator`, `operator:type`, `emergency`, `amenity`,
`healthcare`, `healthcare:speciality`, `addr:*`, `ref`. Convert OSM `lat/lon` to GeoJSON
`[lng, lat]` order.

> OSM is discovery, not ground truth for units/specialties. Never publish an apparatus
> roster sourced only from a map pin — enrich and cite, or leave `units: []`.

## Guardrails (non-negotiable)

- **No fabrication.** If a fact isn't found, record it as unknown (`null`, `[]`,
  `confidence: low`) — never invent unit rosters, trauma levels, or capacities.
- **Cite everything.** Each record needs ≥1 real, resolvable source URL.
- **Respect sources.** Prefer official/open data; honor site terms and robots; don't
  scrape aggressively. Cache/rate-limit Overpass usage.
- **Public data only.** No PII beyond public facility/agency info. No home addresses of
  personnel, no operationally sensitive security details.
- **Stay in schema.** Use controlled vocabularies; don't introduce new `category`/unit
  values without updating the schema + Domain Model in the same PR.
- **Resolve sub-region references.** Every `subregion_id` must match a declared
  `metadata.subregions[].id`, and every sub-region `parent` must resolve (no cycles).
- **Coordinate sanity.** Lat ∈ [-90,90], Lng ∈ [-180,180], and the point falls within/near
  the region bbox.
- **Deduplicate.** Merge OSM + official records for the same physical facility into one.

## Regions generated in parts

Some regions are too big for one pass. New York City is the standard example: five
boroughs, ~2,000 facilities, dozens of agencies — research quality falls off long before
the end, the PR is unreviewable, and one failed run loses the lot. Such a region is
generated **one part at a time** and assembled into a single region file.

What splits is the **generation**, not the region. There is still one `region_id`, one
registry entry, one file the app loads, one map with one set of boroughs in its sub-region
filter. A player never sees the seam.

**Split when** the region has a natural division whose parts each carry enough facilities
to be a session's work (roughly 150+), or when one pass plainly can't source the whole
thing carefully. **Don't split otherwise** — Buffalo's 191 facilities across 44 sub-regions
were one pass, and a manifest for a region one agent can finish is just overhead.

### Layout

```
data/regions/
├─ us-ny-nyc.geojson              # merged — generated, committed, never hand-edited
└─ parts/us-ny-nyc/
   ├─ region.json                 # the manifest: region metadata + the part list
   ├─ manhattan.geojson           # one part per borough
   ├─ brooklyn.geojson
   └─ citywide.geojson            # the region-wide part (see below)
```

- **The manifest owns the region.** `metadata` is exactly the metadata block of the merged
  file — including `subregions`, the borough list — and the only place it is written.
  `parts[]` lists the units of generation with a `status` each. It is the part-level
  request queue in the same way `index.json` is the region-level one: a part sits at
  `requested` with no file at all until someone claims it.
- **A part owns its facilities and nothing else.** `part.region_id`, `part.part_id`, its
  `features`, and optionally `part.subregions` for divisions *inside* the borough it covers
  (neighborhoods, precincts) — each of which must nest under an existing sub-region via
  `parent`. Top-level divisions belong to the manifest, so two parts written in parallel
  can't collide on one.
- **The merged file is a build artifact** that happens to be committed, because the app
  bundles `data/regions/*.geojson` as-is. `npm run validate` re-runs the merge and fails if
  the committed file has drifted from its parts, so it can't rot.

### Workflow

```bash
# 1. queue the region and its parts (one PR, no data yet)
npm run new-region -- --id us-ny-nyc --name "New York City, NY" \
  --admin-name "New York" --center -73.97,40.7 --zoom 10 --part-level borough \
  --parts "manhattan:Manhattan,brooklyn:Brooklyn,queens:Queens,bronx:The Bronx,staten-island:Staten Island"

# 2. claim one part and scaffold its file
npm run new-region -- --id us-ny-nyc --part manhattan --status in_progress --scaffold

# 3. generate it — the main workflow above, bounded to that borough

# 4. assemble and check
npm run merge-region -- --id us-ny-nyc
npm run validate

# 5. one PR per part: the part file, its manifest line, the merged file, the registry count
```

`npm run new-region -- --list` shows each part under its region, so the queue reads as the
work it actually is. A part added after the fact (`--part staten-island --name "Staten
Island"`) declares its sub-region too.

### Rules that exist only because parts are written in parallel

- **Stay in your lane.** Every facility in a part must sit in the sub-region the part
  covers, or one nested inside it. The validator fails a part that annexes another's
  facilities — which is otherwise invisible, because the merged file is still valid.
- **Facility ids are unique across the whole region, not the part.** Prefix them with the
  part (`nyc-mn-e004`, `nyc-bk-e207`) and the question never comes up. The validator names
  both parts when two collide.
- **Region-wide facilities go in one region-wide part.** An FDNY headquarters, a port
  authority, an FBI field office belong to no borough. Give them a part with no
  `subregion_id` (`citywide`) rather than filing them under whichever borough they
  physically sit in, or two parts will both claim them and a third round of edits will
  drop them. Add one with
  `npm run new-region -- --id <region_id> --part citywide --subregion none`.
- **Touch only your own part.** A part PR edits its own file and its own line of the
  manifest. Changing the borough list, the center or the zoom is a manifest-level change,
  and belongs in its own PR.
- **Never hand-edit the merged file.** Re-run `merge-region`. On a git conflict in it, take
  either side and re-run — the parts are the source of truth, and part order in the merged
  file follows the manifest, so two boroughs' facilities never interleave.
- **Coverage and gaps are reported per part.** The region's registry `note` describes the
  whole; each part PR states what it covered and what it couldn't, so a half-generated
  region says so honestly instead of looking finished at 40%.

**Definition of done for a part:** `npm run merge-region` then `npm run validate` pass,
every record cites ≥1 source, its facilities are all in its own sub-region, and its status
in the manifest is `published`. **For the region:** every part published, and the registry
entry moved to `published` — until then it stays `in_progress`, however many parts are in.

## Non-US regions

Discovery is unchanged — OSM/Overpass tags are international. **Enrichment and
normalization are not.** Before generating a non-US region, read
[02 § Facility categories](02-domain-model.md#facility-categories) on which categories
describe a country's *structure*, and
[03 § Addresses](03-data-schema.md#addresses-across-countries).

Country-independent rules:

- `country` is **ISO 3166-1 alpha-2** — the UK is **`GB`**, not `UK` — and `region_id`
  leads with it (`gb-mersey-liverpool`). `npm run new-region` derives the country from the
  slug, so get the slug right.
- Omit `address.state` where the country has no first-level admin area in an address. Do
  **not** invent one, and don't repeat the county there.
- Set `metadata.game_edition` to the edition your `game` blocks target (see
  [02 § Editions](02-domain-model.md#editions)) — in-game building names differ per edition.
- Never carry a designation from another country's system. ACS trauma levels are US-only
  and the validator enforces it; state the local designation in
  `attributes.trauma_designation` and tier it with `trauma_major`/`trauma_unit`.

### UK sources (Phase 6 target)

| Category | Where the planning detail lives |
| --- | --- |
| `fire` | The Fire and Rescue Service's own station pages — most publish station locations and appliance allocations; FRS integrated risk management plans for coverage detail. |
| `ems` | The regional NHS ambulance trust's station/estate lists; HART capability is usually named on the trust site. Air ambulances are **separate charities** with their own base pages. |
| `police_local` | The territorial force's station/estate pages and firearms-capability statements. Note there is **no sheriff tier**. |
| `police_national` | NCA, British Transport Police, Border Force, MOD Police, Civil Nuclear Constabulary — national, so `agency.level: national`. |
| `hospital` | NHS trust A&E pages plus the **major trauma network** designation (Major Trauma Centre vs Trauma Unit). No ACS levels. |
| `prison` | The national prison-service estate list; the nearest `jail` analogue is a police custody suite. |
| `coast_guard` | HM Coastguard rescue teams and operations centres. |
| `sea_rescue` | The RNLI station directory (a charity — `agency.type: rescue_service`, `level: private`). |
| `mountain_rescue` | Individual volunteer team sites and their regional association. |
| `dispatch` | 999 handling is per-service control rooms, not a consolidated PSAP — record the service's control room and say so in the `subtype`. |

The "no fabrication" bar is unchanged and matters more here, because the structures are
unfamiliar: an English fire service's appliance list is not a US apparatus roster, and
guessing at one because the shape looks similar is exactly the failure this contract exists
to prevent.

## Depth passes over a published region

A published region is a **first** pass. Discovery finds the buildings; the apparatus
rosters, specialties, trauma designations and capacities behind them are won one source at
a time, and today about half the catalog's fire and EMS records still carry no units at
all. A **depth pass** is a second run over a region that already exists — same contract,
narrower target.

**A depth pass is always prompted.** Nothing here re-runs an agent over published data on
a schedule, and nothing should: an unattended pass would rewrite sourced records with
nobody reading the diff. One starts from exactly three places:

- a **region-review issue** (`.github/ISSUE_TEMPLATE/06-region-review.yml`, linked from
  every region in the app), or
- whatever `npm run report -- --stale` puts at the top of its list, or
- a maintainer asking for a region to be deepened.

- **Input:** the published `data/regions/<region_id>.geojson`, plus an optional focus —
  units, specialties, hospitals, one sub-region.
- **Output:** the same file, edited in place. One region per PR, reviewable as a diff
  against what was published.

### Workflow

1. **See where the region actually stands.** `npm run report -- --region <region_id>`
   prints unit coverage by category, specialty tagging, the confidence mix, trauma
   completeness and what gaps are already declared.
2. **Target the thin records**, in the order the value sits: fire/EMS houses with
   `units: []`, hospitals with no trauma statement, facilities with no `specialties`,
   records whose `last_verified` is oldest, anything at `confidence: low`.
3. **Work the sources** exactly as a first pass does — official department and agency
   pages, open-data portals, published rosters and annual reports first; enthusiast
   registries as `medium`/`low`, always cited. The guardrails below are unchanged: no
   fabrication, public sources only, unknowns stay unknown.
4. **Edit in place.** Update the records you improved and leave the rest alone. A record
   you could not improve stays exactly as it is — see the rules below.
5. **Declare what you searched and couldn't find** in `metadata.coverage` (`docs/03`):
   the categories you covered, and each gap with the reason it's a gap. This is how "we
   looked and it isn't public" stops looking identical to "nobody looked".
6. **Move the dates.** `last_verified` on every record you actually checked;
   `metadata.last_reviewed` to the date of the pass — once, for the region.
7. **Sync the registry:** `npm run new-region -- --sync --id <region_id>`, which copies
   the new review date and facility count onto the `index.json` entry.
   (`index.json` is that script's to write — don't hand-edit it.)
8. **Validate:** `npm run validate` must pass.
9. **Open a PR** that says what moved: the `npm run report -- --region <region_id>` numbers
   before and after, what you added, and what you looked for and couldn't find.

### Rules specific to a depth pass

- **Never delete a record because you couldn't deepen it.** A facility with a confirmed
  building, an address and a source is the product working as intended; an empty `units`
  array is a to-do, not a defect. Removing it to raise a percentage is the one outcome
  this whole loop exists to prevent.
- **Never invent to fill a number.** The report is advisory and no threshold gates
  anything, so 20% unit coverage that is true beats 80% that isn't.
- **Don't touch what you didn't verify.** Leave `confidence` where it is unless a source
  actually moved it, and don't re-date `last_verified` on records you only read past.
- **Lower a confidence when the evidence says so.** A pass that finds a station closed, a
  roster withdrawn or a source rotted is a successful pass; record it.
- **A pass that finds nothing still counts** — bump `metadata.last_reviewed`, declare what
  you searched in `metadata.coverage`, and say so in the PR. "Looked, found nothing new"
  is information, and it stops the next pass repeating the same dead ends.

### Suggested prompt (template)

> You are running a **depth pass** over the existing Dispatch Atlas region `{region_id}`.
> Follow `docs/06-data-generation-agent.md` § Depth passes and `docs/03-data-schema.md`.
> Start from `npm run report -- --region {region_id}`, then work the thin records —
> `units: []` first, then untagged specialties, hospitals with no trauma statement, and the
> oldest `last_verified` dates — using official sources. Edit
> `data/regions/{region_id}.geojson` in place; never remove or invent a record, and leave
> anything you couldn't verify exactly as it is. Record what you searched and what is
> genuinely not public in `metadata.coverage`, bump `last_verified` on the records you
> checked and `metadata.last_reviewed` once, then run
> `npm run new-region -- --sync --id {region_id}` and `npm run validate`. Summarize the
> before/after numbers and what you couldn't find.

## Quality bar per category

- **Fire/EMS:** house-by-house where possible; apparatus list is the headline value.
- **Police/Sheriff:** precinct/HQ locations + note SWAT/K9/air/marine units the agency
  operates (attach to the facility that hosts them, else the HQ).
- **Hospital:** ED presence, **trauma level**, helipad, and notable specialty centers.
- **Prison/Jail:** type, security level, approximate capacity.
- **Tow/Dispatch:** locations; mark `confidence` honestly (often sparse public data).

## Suggested agent prompt (template)

> You are generating a Dispatch Atlas region file for **{REGION}**. Follow
> `docs/06-data-generation-agent.md` and `docs/03-data-schema.md` exactly. Discover
> facilities via OSM/Overpass within the region bbox, enrich each with planning-relevant
> detail from official/open sources, and emit a schema-valid
> `data/regions/{region_id}.geojson` plus an `index.json` entry. Cite every record, score
> confidence honestly, and never fabricate units or capabilities. Run `npm run validate`
> and fix all errors before finishing. Summarize coverage and gaps.

For one part of a region generated in parts:

> You are generating **one part** of the Dispatch Atlas region `{region_id}`: the part
> `{part_id}`, covering **{BOROUGH}**. Follow `docs/06-data-generation-agent.md` — including
> § Regions generated in parts — and `docs/03-data-schema.md` exactly. Read
> `data/regions/parts/{region_id}/region.json` first: it declares the region's sub-regions
> and which one your part covers. Write **only**
> `data/regions/parts/{region_id}/{part_id}.geojson` and your own line of that manifest.
> Every facility must sit in your part's sub-region (or one you nest inside it via
> `part.subregions`), carry an id prefixed for your part, and cite ≥1 real source. Facilities
> that serve the whole region belong to the region-wide part, not yours — leave them out.
> Then run `npm run merge-region -- --id {region_id}` and `npm run validate`, fix all errors,
> and summarize what you covered and what you couldn't.

## Scaling to many regions

- One PR per region keeps reviews tractable and data auditable — or one per **part**, for
  a region generated in parts (above), which is the same bargain one level down.
- A batch runner can fan out over a list of regions, but each still validates
  independently and merges on its own. Parts of one region can likewise be generated in
  parallel; the lane and id rules above are what make that safe.
- Track requested/queued regions in `index.json` (`status: requested | in_progress | published`).
  `scripts/new-region.mjs` owns that file — don't hand-edit it:

  ```bash
  # queue one for later
  npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY (Erie County)"

  # queue a batch from a JSON array of the same fields
  npm run new-region -- --batch regions-wanted.json

  # claim one and scaffold an empty, already-valid file to fill in
  npm run new-region -- --id us-ny-buffalo --name "Buffalo, NY" \
    --center -78.8784,42.8864 --zoom 11 --status in_progress --scaffold --force

  npm run new-region -- --list      # what's queued, in progress, published
  ```

  A queued entry has no `file` until one exists; `npm run validate` enforces that a
  `published` entry has data and that no entry points at a missing file.
