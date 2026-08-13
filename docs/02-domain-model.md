# 02 — Domain Model

This document defines the **real-world facility taxonomy** the catalog records, the
**units/apparatus** that run from them, and how each maps onto **Mission Chief** buildings
and vehicles. The schema in [03 — Data Schema](03-data-schema.md) is the machine-readable
encoding of this model.

## Core entities

```
Region ──declares──▶ Subregion (borough/district/municipality) [0..n, nestable]
   │                      ▲
   └──has many──▶ Facility ─┤ (subregion_id)
                    │   └──run by──▶ Agency
                    └──houses──▶ Unit (apparatus / crew) [0..n]
```

- **Region** — a city/metro/county area; one GeoJSON data file per region.
- **Subregion** — a local-level division *within* a region (an NYC borough, a county's
  municipalities, a city's districts/neighborhoods). Declared in the region's
  `metadata.subregions`; facilities reference one via `subregion_id`. Optional and
  nestable — see [Data Schema § Sub-regions](03-data-schema.md#sub-regions-local-level-narrowing).
- **Facility** — a physical building/site (a fire house, precinct, hospital, jail, tow
  yard, dispatch center…). The central entity.
- **Agency** — the organization that operates the facility (a municipal fire department, a
  county sheriff's office, a state highway patrol, an FBI field division…).
- **Unit** — an apparatus or crew stationed at a facility (Engine 5, Ladder 2, Medic 7,
  a SWAT vehicle, a K9 unit, a heavy wrecker…).

## Facility categories

`category` is the primary controlled vocabulary. Keep it small and stable; use `subtype`
for finer detail.

| `category` | Real-world examples | Typical `subtype`s |
| --- | --- | --- |
| `fire` | Fire stations / fire houses | `career`, `volunteer`, `combination`, `arff` (airport) |
| `ems` | Ambulance/EMS stations, medic posts | `hospital_based`, `third_service`, `private`, `fire_based` |
| `police_local` | Municipal police stations/precincts | `precinct`, `headquarters`, `substation` |
| `sheriff` | County sheriff's offices, substations | `hq`, `substation`, `patrol` |
| `state_le` | State police / highway patrol posts | `post`, `troop_hq`, `weigh_station` |
| `federal_le` | FBI/DEA/ATF/USMS/HSI/CBP/USSS offices | `field_office`, `resident_agency`, `sector` |
| `hospital` | Hospitals with an emergency department | `trauma_center`, `community`, `childrens`, `psychiatric`, `va` |
| `clinic` | Urgent care / clinics (minor in-game role) | `urgent_care`, `clinic` |
| `prison` | State/federal prisons | `state`, `federal`, `private` |
| `jail` | County/city jails, detention centers | `county`, `city`, `detention`, `booking` |
| `tow` | Tow depots, impound lots, yards | `police_impound`, `private`, `heavy` |
| `dispatch` | 911 PSAP / communications centers | `psap`, `secondary`, `eoc` |
| `coast_guard` | USCG stations | `station`, `sector`, `air_station` |
| `ranger` | Park/forest ranger & wildland stations | `ranger`, `wildland`, `helitack` |

> Add a new category only when an existing one genuinely cannot represent the facility.
> Categories drive map layers, colors, and filters — churn here is expensive.

## Unit / apparatus types

`Unit.type` controlled vocabulary. Units carry a `count` and optional type-specific
`attributes` (e.g. aerial length, tank size, ALS/BLS).

**Fire:** `engine` (pumper), `ladder` (aerial/truck), `quint`, `rescue` (squad),
`tanker` (tender), `brush` (wildland), `hazmat`, `battalion` (chief/command),
`air_light` (air & light unit), `arff` (airport crash), `foam`, `rehab`.

**EMS:** `ems_als` (paramedic ambulance), `ems_bls` (basic ambulance), `medic_chase`
(fly-car/supervisor), `mci` (mass-casualty bus).

**Marine / air:** `marine` (fire/rescue boat), `dive`, `air_support` (helicopter).

**Police:** `patrol`, `swat` (tactical), `k9`, `mounted`, `bomb_squad` (EOD),
`crime_scene`, `traffic`, `police_air`, `police_marine`.

**Tow:** `tow_light`, `tow_medium`, `tow_heavy` (wrecker), `flatbed`.

Keep unit vocabulary aligned with the **capabilities** players care about; if a unit type
doesn't affect a planning decision, fold it into a nearby type or a `specialties` tag.

## Specialties (capability tags)

`specialties` is a flat list of controlled tags describing capabilities that matter for
planning, independent of a single unit — e.g.:

`hazmat`, `technical_rescue`, `swiftwater`, `high_angle`, `confined_space`,
`wildland`, `marine_rescue`, `dive_rescue`, `arff`, `swat`, `k9`, `bomb_squad`,
`air_support`, `trauma_level_1`, `trauma_level_2`, `stroke_center`, `cardiac_center`,
`burn_center`, `pediatric`, `helipad`, `booking`, `max_security`.

## Mission Chief mapping

The `game` block on each facility ties real facilities to in-game equivalents. This is the
bridge that makes the catalog a *planning* tool rather than a generic POI map.

| Real category | Maps to Mission Chief building(s) | Notes for planning |
| --- | --- | --- |
| `fire` | Fire Station / (Small) Fire Station | Stock engines/ladders/rescues to match the real house; volunteer houses = smaller builds. |
| `ems` | Rescue Station / hospital-based ambulances | ALS vs BLS matters for patient transports. |
| `police_local` / `sheriff` | Police Station | Add SWAT/K9 buildings where the real agency has those units. |
| `state_le` | (State) Police Station | Highway patrol posts → coverage of interstates/rural missions. |
| `federal_le` | Federal / specialized buildings | Rarer; supports high-tier federal missions. |
| `hospital` | Hospital | Trauma level & specialties gate which patients you can deliver. |
| `prison` / `jail` | Prison | Prisoner transport & riot missions. |
| `tow` | Tow / impound | Needed for vehicle-recovery missions. |
| `dispatch` | Dispatch Center | Coordination context, not always a buildable. |

Because in-game building/vehicle names drift with game updates, treat the mapping as
**guidance**, not a hard contract. `game.building_types` is a list of strings, and
`game.notes` carries the human-readable planning advice.

## Data quality model

Every facility carries:

- **`sources[]`** — where each fact came from (URL + title + retrieval date).
- **`confidence`** — `high` / `medium` / `low` for the record as a whole.
- **`last_verified`** — when a human/agent last checked it.

Unknown fields are `null`/omitted — **never invented**. A fire house whose exact
apparatus roster is unknown records `units: []` with `confidence: low`, not a guess.
