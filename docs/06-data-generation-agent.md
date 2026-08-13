# 06 — Data-Generation Agent

This is the operating contract for the agent that turns **"a player is interested in
`<city/region>`"** into a **schema-valid region GeoJSON file** committed to `data/regions/`.

## Objective

Given a place (e.g. "Springfield, IL" or "King County, WA"), produce a normalized,
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

## Scaling to many regions

- One PR per region keeps reviews tractable and data auditable.
- A batch runner can fan out over a list of regions, but each still validates
  independently and merges on its own.
- Track requested/queued regions in `index.json` (`status: requested | in_progress | published`).
