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
                                     // sheriff_office | state_agency | federal_agency |
                                     // ems_agency | hospital_system | corrections | private
    "level": "municipal",            // municipal | county | state | federal | private
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
| `address` | ✅ | At least `city` + `state` + `country`; street optional if unknown. |
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
    "schema_version": 1
  },
  "features": [ /* Facility Features */ ]
}
```

Region files are registered in [`data/regions/index.json`](../data/regions/index.json) so
the app can list available regions without scanning the filesystem.

### Sub-regions (local-level narrowing)

Large regions need a second level of grouping so a player can narrow to a **borough**
(NYC), **municipality** (a county), or **district/neighborhood** (a city). Sub-regions are
declared once in `metadata.subregions`, and each facility points at the most specific one
via `properties.subregion_id`.

| Field | Req? | Notes |
| --- | --- | --- |
| `id` | ✅ | Kebab-case slug, unique within the region. |
| `name` | ✅ | Display name (e.g. "Manhattan"). |
| `level` | — | `borough` \| `county` \| `municipality` \| `district` \| `township` \| `precinct` \| `sector` \| `neighborhood` \| `other`. Labels/groups the picker. |
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

## Conventions

- **Coordinates:** WGS84, `[lng, lat]` (GeoJSON order), ~5 decimal places (~1 m).
- **Dates:** ISO 8601 (`YYYY-MM-DD`).
- **IDs:** lowercase kebab-case; region-scoped uniqueness for `id`, globally unique
  `region_id` (e.g. `us-<state>-<city>`).
- **Enums over free text** wherever a value drives UI (category, unit type, specialties).
- **Additive schema evolution:** bump `schema_version` and keep validators backward
  compatible; never silently repurpose a field.
