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
| `police_local` | Municipal police stations/precincts; UK territorial force stations | `precinct`, `headquarters`, `substation` |
| `sheriff` | County sheriff's offices, substations *(US structure)* | `hq`, `substation`, `patrol` |
| `state_le` | State police / highway patrol posts *(US structure)* | `post`, `troop_hq`, `weigh_station` |
| `federal_le` | FBI/DEA/ATF/USMS/HSI/CBP/USSS offices *(US structure)* | `field_office`, `resident_agency`, `sector` |
| `police_national` | National forces in countries with no state tier — UK NCA, British Transport Police, Border Force; Bundespolizei | `hq`, `division`, `station` |
| `hospital` | Hospitals with an emergency department | `trauma_center`, `community`, `childrens`, `psychiatric`, `va` |
| `clinic` | Urgent care / clinics (minor in-game role) | `urgent_care`, `clinic` |
| `prison` | State/federal prisons | `state`, `federal`, `private` |
| `jail` | County/city jails, detention centers | `county`, `city`, `detention`, `booking` |
| `tow` | Tow depots, impound lots, yards | `police_impound`, `private`, `heavy` |
| `dispatch` | 911 PSAP / communications centers | `psap`, `secondary`, `eoc` |
| `coast_guard` | **State** maritime services — USCG stations, HM Coastguard rescue teams & operations centres | `station`, `sector`, `air_station`, `rescue_team`, `operations_centre` |
| `sea_rescue` | **Declared rescue** lifeboat services, typically volunteer/charity — RNLI, DGzRS | `lifeboat_station`, `inshore`, `all_weather` |
| `mountain_rescue` | Volunteer mountain, cave & lowland rescue teams | `mountain`, `cave`, `lowland` |
| `civil_protection` | Civil-protection / disaster-relief depots (THW-style) | `depot`, `local_section`, `warehouse` |
| `ranger` | Park/forest ranger & wildland stations | `ranger`, `wildland`, `helitack` |

> Add a new category only when an existing one genuinely cannot represent the facility.
> Categories drive map layers, colors, and filters — churn here is expensive. Each one must
> also fit an existing **service group** (`src/lib/categories.ts`); a sixth group means
> re-deriving the whole mode-invariant palette. The `schema_version` 2 additions all joined
> *Fire & rescue* or *Law enforcement* for exactly that reason.

Some categories describe a **country's structure** rather than a universal service. Pick by
what the country actually has, and don't force a match:

- `sheriff` / `state_le` / `federal_le` describe the US's county → state → federal tiers.
  Countries with no state layer use `police_local` for territorial forces and
  `police_national` above them.
- `coast_guard` is the **state** maritime service; a volunteer/charity lifeboat service is
  `sea_rescue`. Filing the RNLI as `coast_guard` would misrepresent both.
- `jail` vs `prison` is a US distinction (county holding vs state/federal sentence). Where
  the prison estate is national — HM Prisons, for instance — use `prison`, and reserve
  `jail` for short-term police custody facilities.
- `dispatch` covers a consolidated 911 PSAP *and* a single service's control room; the
  `subtype` carries which.

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

### Unit vocabulary across countries

The vocabulary is deliberately capability-based, not name-based, so most countries map onto
it without new values — the local *name* goes in `designation`. The UK mapping, as the
first non-US target:

| UK apparatus / crew | `Unit.type` | Note |
| --- | --- | --- |
| Pumping appliance / "pump", water ladder | `engine` | The workhorse; `designation` carries the local label. |
| Aerial ladder platform, turntable ladder | `ladder` | `attributes.aerial_ft`/`platform` as usual. There is no UK quint. |
| Rescue pump, heavy rescue, fire rescue unit | `rescue` | — |
| Water carrier / bulk water | `tanker` | — |
| Command unit / incident command unit | `battalion` | The command function, not a chief's car. |
| Double-crewed ambulance | `ems_als` / `ems_bls` | By crew skill mix (paramedic vs technician), stated in `attributes`. |
| Rapid response vehicle, paramedic car | `medic_chase` | — |
| Hazardous Area Response Team vehicle | `rescue` + `specialties: technical_rescue` | HART is a capability, not an apparatus class. |
| Armed response vehicle | `swat` | UK firearms capability is vehicle-based, not a standing building. |
| Dog unit / dog van | `k9` | — |
| Lifeboat (all-weather or inshore) | `marine` | On a `sea_rescue` station. |

If a country's service genuinely has no analogue, add a value to the schema **and** this
document in the same change — don't stretch an existing one past recognition.

## Specialties (capability tags)

`specialties` is a flat list of controlled tags describing capabilities that matter for
planning, independent of a single unit — e.g.:

`hazmat`, `technical_rescue`, `swiftwater`, `high_angle`, `confined_space`,
`wildland`, `marine_rescue`, `dive_rescue`, `arff`, `swat`, `k9`, `bomb_squad`,
`air_support`, `trauma_major`, `trauma_unit`, `stroke_center`, `cardiac_center`,
`burn_center`, `pediatric`, `helipad`, `booking`, `max_security`.

### Trauma capability

Trauma designations are **national systems**, so the tag that drives filtering is the
normalized tier and the designation itself is recorded as issued:

| Tier tag | US (ACS) | UK (major trauma networks) |
| --- | --- | --- |
| `trauma_major` | Level I–II | Major Trauma Centre |
| `trauma_unit` | Level III–IV | Trauma Unit |

The country's own label lives in `attributes.trauma_designation`
(`{ "system": "acs", "label": "Level I" }`). The older US-only tags `trauma_level_1` /
`trauma_level_2` and `attributes.trauma_level` remain valid **on US records only** —
`npm run validate` rejects them elsewhere, because "Level I" is not a claim the UK system
makes. See [03 § Trauma capability](03-data-schema.md#trauma-capability-across-systems).

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

### Editions

The game ships as **24 localized editions**, one per country/language, each modelling that
country's own services — so the `game` block above is edition-specific, not universal. Any
edition's footer carries a language switcher listing the other 23; the list below was taken
from the `missionchief.co.uk` and `leitstellenspiel.de` footers (retrieved 2026-08-17) —
23 others on each, plus the site itself, and the two lists agreed exactly.

| Country | Edition site | Country | Edition site |
| --- | --- | --- | --- |
| 🇩🇪 Germany *(original)* | `leitstellenspiel.de` | 🇩🇰 Denmark | `alarmcentral-spil.dk` |
| 🇺🇸 **United States** ← covered | `missionchief.com` | 🇳🇴 Norway | `nodsentralspillet.com` |
| 🇬🇧 **United Kingdom** ← Phase 6 target | `missionchief.co.uk` | 🇨🇿 Czechia | `operacni-stredisko.cz` |
| 🇳🇱 Netherlands | `meldkamerspel.com` | 🇹🇷 Türkiye | `112-merkez.com` |
| 🇪🇸 Spain | `centro-de-mando.es` | 🇵🇹 Portugal | `jogo-operador112.com` |
| 🇦🇺 Australia | `missionchief-australia.com` | 🇧🇷 Brazil | `operador193.com` |
| 🇵🇱 Poland | `operatorratunkowy.pl` | 🇺🇦 Ukraine | `dyspetcher101-game.com` |
| 🇸🇪 Sweden | `larmcentralen-spelet.se` | 🇰🇷 South Korea | `missionchief-korea.com` |
| 🇮🇹 Italy | `operatore112.it` | 🇲🇽 Mexico | `centro-de-mando.mx` |
| 🇫🇷 France | `operateur112.fr` | 🇯🇵 Japan | `missionchief-japan.com` |
| 🇷🇺 Russia | `dispetcher-112.com` | 🇷🇴 Romania | `jocdispecerat112.com` |
| 🇫🇮 Finland | `hatakeskuspeli.com` | 🇸🇰 Slovakia | `dispecerske-centrum.com` |

> The **site list is verbatim**; the country column is inferred from each domain's language
> and emergency number (193 = Brazil's fire brigade, 101 = Ukraine's, 112 = the EU
> number, 999 = UK). The Russian/Ukrainian and Portuguese/Brazilian pairs are the ones
> worth re-checking before anyone relies on them.

Only the US edition is covered today; the UK is the Phase 6 target (see
[07 — Roadmap](07-roadmap.md)). The remaining 22 are the long-term addressable set, and the
reason region files should record which edition their `game` block is written against.

## Data quality model

Every facility carries:

- **`sources[]`** — where each fact came from (URL + title + retrieval date).
- **`confidence`** — `high` / `medium` / `low` for the record as a whole.
- **`last_verified`** — when a human/agent last checked it.

Unknown fields are `null`/omitted — **never invented**. A fire house whose exact
apparatus roster is unknown records `units: []` with `confidence: low`, not a guess.
