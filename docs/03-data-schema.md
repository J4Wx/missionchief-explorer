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

Validation is enforced by `npm run validate` (and in CI). See
[04 — Architecture](04-architecture.md).

## Facility record

```jsonc
{
  "id": "spfd-station-5",            // stable, unique-within-region slug
  "name": "Springfield Fire Station 5",
  "category": "fire",                // see Domain Model controlled vocab
  "subtype": "career",               // optional finer detail
  "subregion_id": "downtown",        // optional; references metadata.subregions[].id
  "status": "active",                // active | closed | planned | unknown

  "agency": {
    "name": "Springfield Fire Department",
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

  "designation": "Station 5",        // station/precinct/post number as used locally
  "address": {
    "street": "123 Main St",
    "city": "Springfield",
    "county": "Sangamon",
    "state": "IL",
    "postal_code": "62701",
    "country": "US"
  },

  "staffing_model": "career",        // career | volunteer | combination | unknown
  "operating_hours": "24_7",         // 24_7 | daytime | on_call | unknown

  "units": [
    {
      "type": "engine",             // Unit vocab from Domain Model
      "designation": "Engine 5",
      "count": 1,
      "attributes": { "pump_gpm": 1500, "tank_gal": 500 }
    },
    {
      "type": "ladder",
      "designation": "Truck 5",
      "count": 1,
      "attributes": { "aerial_ft": 100, "platform": true }
    }
  ],

  "specialties": ["technical_rescue", "hazmat"],

  "attributes": {                    // category-specific free-form (validated loosely)
    // hospital:  beds, ed_beds, trauma_level, helipad, stroke_center, cardiac_center
    // prison/jail: inmate_capacity, security_level
    // police:    swat, k9, patrol_beats
  },

  "game": {
    "building_types": ["Fire Station"],
    "recommended": true,             // optional: worth building early?
    "notes": "Busy downtown house — pair an engine + truck + rescue to mirror it."
  },

  "significance": "Downtown first-due; houses the department's only heavy rescue.",

  "sources": [
    { "title": "Springfield FD — Stations", "url": "https://example.gov/fd/stations",
      "retrieved": "2026-08-13" }
  ],
  "confidence": "high",              // high | medium | low
  "last_verified": "2026-08-13"
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
    "region_id": "us-il-springfield",
    "name": "Springfield, IL",
    "country": "US",
    "center": [-89.65, 39.80],       // [lng, lat] default map center
    "zoom": 11,
    "subregions": [                  // optional local-level divisions (see below)
      { "id": "downtown", "name": "Downtown", "level": "district",
        "parent": null, "center": [-89.648, 39.80], "zoom": 13 }
    ],
    "generated_by": "agent",         // agent | human
    "generated_at": "2026-08-13",
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
| `generated_by` / `generated_at` | — | Provenance of the file itself. |
| `schema_version` | ✅ | Current is **2**. |

Region files are registered in [`data/regions/index.json`](../data/regions/index.json) so
the app can list available regions without scanning the filesystem. An entry carries
`region_id`, `name`, `country`, `status` (`requested | in_progress | published`), `file`
once one exists, and an optional `note`:

| Registry field | Req? | Notes |
| --- | --- | --- |
| `admin` | — | The division segment of `region_id` (`ga`, `mersey`), repeated as data so the region picker can group without parsing slugs. The validator fails an entry whose `admin` disagrees with its `region_id`. |
| `admin_name` | — | Display name for it — "Georgia", "Merseyside". The picker labels the group with the bare code without it, so set it. Meaningless alone: `admin_name` without `admin` fails. |

Use `npm run new-region` rather than hand-editing the registry; it derives `admin` from
the id and takes `--admin-name`.

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
  `region_id` (e.g. `us-<state>-<city>`).
- **Enums over free text** wherever a value drives UI (category, unit type, specialties).
- **Additive schema evolution:** bump `schema_version` and keep validators backward
  compatible; never silently repurpose a field.

## Schema versions

| Version | Change |
| --- | --- |
| **2** | *Internationalization (Phase 6).* `address.state` no longer required and re-documented as "first-level admin area, where one exists"; `country` constrained to ISO 3166-1 alpha-2; `agency.level` gained `district`/`regional`/`national`; `agency.type` gained `national_police`/`military`/`rescue_service`/`aid_organization`; `category` gained `police_national`/`sea_rescue`/`mountain_rescue`/`civil_protection`; sub-region `level` gained `unitary_authority`/`ward`/`commune`/`region`/`province`; `metadata.game_edition` added; country-neutral trauma tiers introduced. **All additive** — every version-1 file is still valid, and the validator warns rather than fails on one. |
| 1 | Initial schema (Phases 0–5). |
