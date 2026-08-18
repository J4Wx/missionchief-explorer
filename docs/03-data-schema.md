# 03 — Data Schema

The catalog is stored as **GeoJSON**, one `FeatureCollection` file per region, so it drops
straight into a map without transformation while remaining a plain, diff-friendly,
schema-validated file.

- Each **`Feature`** is one facility.
- `Feature.geometry` is a GeoJSON **`Point`** (`[lng, lat]`, WGS84).
- `Feature.properties` conforms to the **Facility** record described below.

Machine-readable schemas live in [`/schemas`](../schemas):

- `facility.schema.json` — a single Facility (the `properties` object).
- `region.schema.json` — a whole region `FeatureCollection`.
- `region-manifest.schema.json` / `region-part.schema.json` — the two authoring files a
  region generated in parts is assembled from; they reuse the definitions above rather
  than restating them. See [Regions generated in parts](#regions-generated-in-parts).

Validation is enforced by `npm run validate` (and in CI). See
[04 — Architecture](04-architecture.md).

## Facility record

A real record, from [`us-ga-savannah.geojson`](../data/regions/us-ga-savannah.geojson):

```jsonc
{
  "id": "sfd-station-1",             // stable, unique-within-region slug
  "name": "Savannah Fire Station 1",
  "category": "fire",                // see Domain Model controlled vocab
  "subtype": "career",               // optional finer detail
  "subregion_id": "midtown-savannah",// optional; references metadata.subregions[].id
  "status": "active",                // active | closed | planned | unknown

  "agency": {
    "name": "Savannah Fire & Emergency Services",
    "type": "fire_department",       // fire_department | police_department |
                                     // sheriff_office | national_police | state_agency |
                                     // federal_agency | ems_agency | hospital_system |
                                     // corrections | military | rescue_service |
                                     // aid_organization | private | other
    "level": "municipal",            // municipal | district | county | regional | state |
                                     // national | federal | private | other
                                     // (state/federal are the US tiers; regional/national
                                     //  cover countries with no state layer)
    "parent": null                   // optional parent agency name
  },

  "designation": "Station 1",        // station/precinct/post number as used locally
  "address": {
    "street": "535 E 63rd St",
    "city": "Savannah",
    "county": "Chatham",
    "state": "GA",
    "postal_code": "31405",
    "country": "US"
  },

  "staffing_model": "career",        // career | volunteer | combination | unknown
  "operating_hours": "24_7",         // 24_7 | daytime | on_call | unknown

  "units": [
    {
      "type": "engine",              // Unit vocab from Domain Model
      "designation": "Engine 1",
      "count": 1
      // "attributes": { "pump_gpm": 1500, "tank_gal": 500 }  — optional, when published
    },
    { "type": "ladder", "designation": "Truck 1", "count": 1 },
    { "type": "rehab", "designation": "Rehab 1", "count": 1 }
  ],

  "specialties": [],                 // capability tags — e.g. ["technical_rescue", "hazmat"]

  "attributes": {},                  // category-specific free-form (validated loosely)
                                     // hospital:  beds, ed_beds, trauma_level, helipad,
                                     //            stroke_center, cardiac_center
                                     // prison/jail: inmate_capacity, security_level
                                     // police:    swat, k9, patrol_beats

  "game": {
    "building_types": ["Fire Station"],
    "recommended": true,             // optional: worth building early?
    "notes": "Midtown career house with an engine + truck; solid all-round early build."
  },

  "significance": "Midtown first-due engine/truck company.",

  "sources": [
    { "title": "Savannah Fire stations & apparatus — GeorgiaFireSource",
      "url": "https://www.georgiafiresource.com/SavannahFD.htm", "retrieved": "2026-08-14" }
  ],
  "confidence": "medium",            // high | medium | low
  "last_verified": "2026-08-14"
}
```

## Field reference

| Field | Req? | Notes |
| --- | --- | --- |
| `id` | ✅ | Kebab-case slug, unique within the region file. Stable across updates. |
| `name` | ✅ | Human-readable display name. |
| `category` | ✅ | Controlled vocab (Domain Model). Drives map layer/color/filter. |
| `subtype` | — | Finer classification within a category. |
| `subregion_id` | — | References a `metadata.subregions[].id` for local-level narrowing (borough/district/municipality). Must resolve if set. |
| `status` | ✅ | Defaults to `active`. Closed/planned facilities are kept for planning context. |
| `agency` | ✅ | Operating organization; `name` required, rest best-effort. |
| `designation` | — | Local unit/house/precinct label. |
| `address` | ✅ | At least `city` + `country` (ISO-2). `state` is the first-level admin area **where one exists** — see [Addresses across countries](#addresses-across-countries). Street optional if unknown. |
| `staffing_model` | — | Career/volunteer distinction affects in-game build size. |
| `operating_hours` | — | Whether staffed 24/7. |
| `units` | ✅ (may be `[]`) | Apparatus/crews. Empty array + `confidence: low` when unknown. |
| `specialties` | — | Capability tags (controlled vocab). |
| `attributes` | — | Category-specific structured extras (beds, trauma_level, etc.). |
| `game` | ✅ | Mission Chief mapping + planning notes. `building_types` required. |
| `significance` | — | One or two sentences on why it matters for planning. |
| `sources` | ✅ (≥1) | Provenance. Every record must cite at least one source. |
| `confidence` | ✅ | Overall record confidence. |
| `last_verified` | — | ISO date of last check. |

## Region file

```jsonc
{
  "type": "FeatureCollection",
  "metadata": {
    "region_id": "us-ga-savannah",
    "name": "Savannah, GA (Chatham County)",
    "country": "US",
    "center": [-81.10, 32.05],       // [lng, lat] default map center
    "zoom": 11,
    "subregions": [                  // optional local-level divisions (see below)
      { "id": "downtown-savannah", "name": "Downtown / Historic District",
        "level": "district", "parent": null, "center": [-81.091, 32.076], "zoom": 14 }
    ],
    "generated_by": "agent",         // agent | human
    "generated_at": "2026-08-14",
    "last_reviewed": "2026-08-14",   // last whole-region pass; moves, generated_at doesn't
    // Optional, and Savannah hasn't declared one yet — what a region that has
    // looks like (Charleston's, shortened):
    // "coverage": {
    //   "searched": ["fire", "ems", "police_local", "hospital", "tow", "dispatch"],
    //   "gaps": [
    //     { "what": "tow operators", "categories": ["tow"], "reason": "no public addresses" }
    //   ],
    //   "note": "Free text for anything the two lists above can't say."
    // },
    "schema_version": 2
  },
  "features": [ /* Facility Features */ ]
}
```

| Metadata field | Req? | Notes |
| --- | --- | --- |
| `region_id` | ✅ | Globally unique slug, `<country>-<admin>-<name>`, lowercase kebab-case. |
| `name` | ✅ | Display name for the region picker. |
| `country` | ✅ | ISO 3166-1 alpha-2 (`US`, `GB`, `DE`). Must match the `region_id` prefix. |
| `game_edition` | — | ISO-2 of the Mission Chief **edition** the `game` blocks target (`US` → missionchief.com, `GB` → missionchief.co.uk). Usually the same as `country`; set it on new regions. See [02 § Editions](02-domain-model.md#editions). |
| `center` / `zoom` | ✅ | Default map view. |
| `subregions` | — | Local divisions; see below. |
| `generated_by` / `generated_at` | — | Provenance of the file itself. `generated_at` is the date it was first built and never moves again. |
| `last_reviewed` | — | ISO date a pass over the **whole region** last happened — first publication, or a depth pass since ([06 § Depth passes](06-data-generation-agent.md#depth-passes-over-a-published-region)). Set it on every published region: it is what `npm run report -- --stale` ranks and what the app shows as review age. Mirrored onto the registry entry. |
| `coverage` | — | What was searched, and what is *known* to be missing. See below. |
| `schema_version` | ✅ | Current is **2**. |

`last_reviewed` is a third date and the three do different jobs, so don't collapse them:
`generated_at` records when the file was built, a facility's `last_verified` records when
*that record* was last checked against its sources, and `last_reviewed` records when anyone
last worked the region as a whole. A depth pass bumps `last_reviewed` and the
`last_verified` of the records it touched; a one-facility correction bumps only that
record's `last_verified`.

### `coverage` — declared gaps

Optional, and the difference between "we looked and there is nothing" and "nobody looked".
An absent block means nobody has declared coverage for the region yet — that shows up in
`npm run report` as something to fill in, and is never an error.

| Field | Req? | Notes |
| --- | --- | --- |
| `searched` | — | Categories deliberately searched for. A category listed here with **no** facilities in the file is a real absence; one missing from the list was never looked for. |
| `gaps[].what` | ✅ | What is missing, in a player's words — "tow operators", "volunteer apparatus rosters". |
| `gaps[].categories` | — | The categories it falls under, where it maps onto them. |
| `gaps[].reason` | ✅ | Why it is missing. "No public addresses", not "TODO" — a gap with no reason is just an excuse. |
| `gaps[].count` | — | How many records are known to be missing, where the number is known (five departments that couldn't be placed). |
| `note` | — | Free text for what the structured fields can't say. |

A declared gap is **not** a licence to thin a region: nothing in the app or CI treats a gap
as a reason to drop records, and no coverage number gates publication (Phase 8). It exists
so the UI can say "not covered here" instead of implying absence.

Region files are registered in [`data/regions/index.json`](../data/regions/index.json) so
the app can list available regions without scanning the filesystem. An entry carries
`region_id`, `name`, `country`, `status` (`requested | in_progress | published`), `file`
once one exists, and an optional `note`:

| Registry field | Req? | Notes |
| --- | --- | --- |
| `admin` | — | The division segment of `region_id` (`ga`, `mersey`), repeated as data so the region picker can group without parsing slugs. The validator fails an entry whose `admin` disagrees with its `region_id`. |
| `admin_name` | — | Display name for it — "Georgia", "Merseyside". The picker labels the group with the bare code without it, so set it. Meaningless alone: `admin_name` without `admin` fails. |
| `center` | ✅ *(published)* | `[lng, lat]` — the region's pin on the global map, copied from the file's `metadata.center`. |
| `facility_count` | — | How many facilities the file holds, for the pin's bubble and the region list. Absent is a warning, not an error. |
| `last_reviewed` | — | Copy of the file's `metadata.last_reviewed`, so the app can rank review age across regions without downloading any of them. Absent on a published entry is a warning. |

`center`, `facility_count` and `last_reviewed` are **duplicated on purpose**: the global map
is the landing view, and plotting every region — or ranking which one has waited longest for
a look — has to cost nothing, so it reads the registry rather than downloading region files
(`docs/04`'s "never ship all regions at once"). The validator compares all three against the
file whenever the entry points at one, so the copies can't drift — a data PR that adds
facilities and forgets the count fails with the number it should be. `npm run new-region`
and `npm run merge-region` write them for you.

Use `npm run new-region` rather than hand-editing the registry; it derives `admin` from
the id, takes `--admin-name`, and copies `center`/`facility_count` out of the data file
whenever one exists — so re-running it after filling a region in is what re-syncs them.

### Sub-regions (local-level narrowing)

Large regions need a second level of grouping so a player can narrow to a **borough**
(NYC), **municipality** (a county), or **district/neighborhood** (a city). Sub-regions are
declared once in `metadata.subregions`, and each facility points at the most specific one
via `properties.subregion_id`.

| Field | Req? | Notes |
| --- | --- | --- |
| `id` | ✅ | Kebab-case slug, unique within the region. |
| `name` | ✅ | Display name (e.g. "Manhattan"). |
| `level` | — | `borough` \| `county` \| `unitary_authority` \| `municipality` \| `district` \| `township` \| `commune` \| `ward` \| `precinct` \| `sector` \| `region` \| `province` \| `neighborhood` \| `other`. Labels/groups the picker. `township`/`precinct` are US divisions, `ward`/`unitary_authority` UK, `commune`/`province`/`region` most of Europe. |
| `parent` | — | Id of a parent sub-region, for nesting (e.g. neighborhood → borough). Must resolve to another sub-region; no cycles. |
| `center` / `zoom` | — | Where to fly the map when this sub-region is selected. |
| `bbox` | — | `[west, south, east, north]` bounds, if known. |

**Rules the validator enforces:**

- Every `properties.subregion_id` must match a declared `metadata.subregions[].id`.
- Every sub-region `parent` must match another sub-region `id`, with no cycles.
- Sub-region `id`s are unique within the region.

Sub-regions are **optional** — small regions can omit them entirely (facilities then have
no `subregion_id`). Nesting is supported but not required; most regions need a single flat
level (e.g. the five NYC boroughs).

### Regions generated in parts

A region too big to research in one pass is generated a **part** at a time — usually one
borough per part — and merged into the single region file above. The data schema is
unchanged; what is added is where the pieces live before the merge:

```
data/regions/
├─ us-ny-nyc.geojson              # merged: generated by `npm run merge-region`
└─ parts/us-ny-nyc/
   ├─ region.json                 # manifest — schemas/region-manifest.schema.json
   └─ <part_id>.geojson           # part    — schemas/region-part.schema.json
```

The **manifest** holds `metadata` — the exact metadata block of the merged file, including
the region's `subregions` — plus a `parts[]` list:

| Part field | Req? | Notes |
| --- | --- | --- |
| `id` | ✅ | Kebab-case, unique within the region. The part's file is always `<id>.geojson`. |
| `name` | — | Display name ("Staten Island"). |
| `subregion_id` | — | The sub-region this part covers; must be declared in `metadata.subregions`. Every facility in the part must sit in it or a descendant. Omit for a deliberately region-wide part (agency HQs, federal offices). |
| `status` | ✅ | `requested \| in_progress \| published`, exactly as in the registry — the manifest is the part-level request queue. |
| `note` | — | What this part should focus on, or what it left out. |

A **part file** is a `FeatureCollection` of facilities with a `part` block instead of
`metadata`: `region_id` and `part_id` (which must match the manifest and the filename),
`schema_version`, optional `name`/`generated_by`/`generated_at`/`note`, and optional
`subregions` for divisions *inside* the one it covers — each of which must have a `parent`.
Region-wide divisions belong to the manifest, so parts written in parallel can't collide.

**Rules the validator enforces**, beyond everything the merged file is already checked for:

- The merged file matches a fresh merge of the manifest and parts. Hand-editing it, or
  forgetting `npm run merge-region`, fails the build.
- A facility appears in exactly one part, and sits inside the sub-region its part covers.
- A part file is declared in the manifest, agrees with it on `region_id`/`part_id`, and
  exists if the manifest says it is `published`.

The workflow — queueing a split region, claiming a part, merging — is
[06 § Regions generated in parts](06-data-generation-agent.md#regions-generated-in-parts).

## Addresses across countries

`address` is deliberately shallow, and **`state` is optional** — many countries have no
first-level administrative area in an address at all. Rather than a per-country field set,
the two admin fields are defined by *level*:

| Field | Meaning | US | UK | Germany |
| --- | --- | --- | --- | --- |
| `city` | Town/city as locally addressed | city | post town | Stadt |
| `county` | Second-level admin area | county | county / unitary authority | Kreis |
| `state` | First-level admin area, **omit if none** | state | *(omit)* | Land |
| `postal_code` | — | ZIP | postcode | PLZ |
| `country` | **ISO 3166-1 alpha-2** | `US` | **`GB`** (not `UK`) | `DE` |

Rules the validator enforces:

- `country` matches `^[A-Z]{2}$` on both facilities and region metadata.
- `metadata.region_id` starts with the region's own country code, lowercased — a `GB`
  region cannot sit behind a `us-` slug.
- A facility whose `country` differs from its region's is a **warning**, not an error
  (border metros are legitimate, mistakes are more likely).

Display formatting is the app's job, not the data's: the record stores parts, and the UI
orders them per country.

## Trauma capability across systems

Trauma designations are national systems that don't map onto each other. Encoding one
country's scale as if it were universal is the fastest way to fabricate a fact, so the
schema separates the **filterable tier** from the **designation as issued**:

| What | Where | Example (US) | Example (UK) |
| --- | --- | --- | --- |
| Normalized tier — drives filters across regions | `specialties` | `trauma_major` | `trauma_major` |
| The designation in its own system | `attributes.trauma_designation` | `{ "system": "acs", "label": "Level I" }` | `{ "system": "nhs_mtn", "label": "Major Trauma Centre" }` |
| Legacy US-only tags, still valid | `specialties`, `attributes.trauma_level` | `trauma_level_1`, `1` | ✗ rejected by the validator |

- `trauma_major` — top-tier receiving centre (ACS Level I–II, a UK Major Trauma Centre).
- `trauma_unit` — second-tier trauma-receiving hospital (ACS Level III–IV, a UK Trauma Unit).

The tier mapping is an approximation *for filtering only*; the honest, sourced fact is the
`trauma_designation` label. `trauma_level_*` and `attributes.trauma_level` are the ACS
numeric scale, so **`npm run validate` rejects them on any non-US record**.

## Conventions

- **Coordinates:** WGS84, `[lng, lat]` (GeoJSON order), ~5 decimal places (~1 m).
- **Dates:** ISO 8601 (`YYYY-MM-DD`).
- **IDs:** lowercase kebab-case; region-scoped uniqueness for `id`, globally unique
  `region_id` (e.g. `us-<state>-<city>`). "Region-scoped" spans every part of a region
  generated in parts, so prefix facility ids per part (`nyc-mn-…`, `nyc-bk-…`).
- **Enums over free text** wherever a value drives UI (category, unit type, specialties).
- **Additive schema evolution:** bump `schema_version` and keep validators backward
  compatible; never silently repurpose a field.

## Schema versions

| Version | Change |
| --- | --- |
| **2** | *Internationalization (Phase 6).* `address.state` no longer required and re-documented as "first-level admin area, where one exists"; `country` constrained to ISO 3166-1 alpha-2; `agency.level` gained `district`/`regional`/`national`; `agency.type` gained `national_police`/`military`/`rescue_service`/`aid_organization`; `category` gained `police_national`/`sea_rescue`/`mountain_rescue`/`civil_protection`; sub-region `level` gained `unitary_authority`/`ward`/`commune`/`region`/`province`; `metadata.game_edition` added; country-neutral trauma tiers introduced. **All additive** — every version-1 file is still valid, and the validator warns rather than fails on one. |
| 1 | Initial schema (Phases 0–5). |

`schema_version` describes the *record* format, so the manifest and part files carry the
same one — splitting a region's generation changed how files are authored, not what a
Facility is.
