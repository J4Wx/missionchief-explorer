# 05 — Frontend & UX

## Layout

A three-region, map-centric layout (responsive → stacked on mobile):

```
┌───────────────────────────────────────────────────────────────┐
│ Top bar: [Dispatch Atlas]  [Region ▾]  [Sub-region ▾]  [Search…] [About] │
├───────────────┬───────────────────────────────────────────────┤
│  Filter rail   │                                                │
│  ─────────────  │                 MAP (MapLibre GL)             │
│  Categories ☑  │           clustered facility markers           │
│  Agencies   ☑  │                                                │
│  Specialties ☑ │                                                │
│  Staffing   ☑  │                                                │
│  ─────────────  ├───────────────────────────────────────────────┤
│  Results list  │   Facility detail panel (opens on select)      │
└───────────────┴───────────────────────────────────────────────┘
```

- **Map** and **results list** are two views of the same filtered feature set — hovering a
  list row highlights the marker and vice-versa.
- **Filter rail** and **search** narrow the set live (client-side).
- **Detail panel** slides in when a facility is selected (from map click or list).

## Views / components

### Region picker
- Dropdown fed by `data/regions/index.json`.
- Selecting a region loads its GeoJSON and recenters the map to `metadata.center/zoom`.
- Persist last-used region in the URL (`?region=us-il-springfield`).

### Sub-region picker
- Appears only when the loaded region declares `metadata.subregions`.
- Lets the player narrow to a **borough/district/municipality** (labeled by `level`);
  nested sub-regions render as a grouped/indented list.
- Selecting one filters the map + list to facilities with that `subregion_id` (and its
  descendants, when nested) and flies to the sub-region's `center`/`zoom` or `bbox`.
- Sub-region counts are shown next to each entry; "All" clears the narrowing.
- Reflected in the URL (`?region=…&sub=manhattan`) for deep links.
- Facilities are also grouped by sub-region in the results list header.

### Map (`MapView`)
- MapLibre GL with a **clustered** GeoJSON source.
- Markers are **colored by service group** and **badged with a per-category code**
  (`FD`, `EM`, `PD`, `JL`, `TW`…). Fourteen simultaneously distinguishable hues don't
  exist, so color carries the group (fire / medical / law enforcement / corrections /
  support) and the badge carries the category — identity never rests on color alone.
  Group colors live in `src/lib/categories.ts` and are validated with the **dataviz**
  skill's checker on the all-pairs pairlist.
- Cluster bubbles show counts; clicking a cluster zooms to expand.
- Clicking a marker selects the facility (opens detail, highlights list row).
- Popups on hover show name + category + designation.
- A legend maps group colors + category badges → categories, with counts for the
  current view.
- Basemap style is configurable via `VITE_MAP_STYLE` (defaults to OpenFreeMap
  Liberty); if it fails to load the list stays usable and the map says so.

### Filter bar / rail (`FilterBar`)
- **Category** multi-select (with counts).
- **Agency** multi-select.
- **Specialty/capability** chips (`swat`, `hazmat`, `trauma_level_1`, `k9`, …).
- **Staffing model** toggle (career/volunteer/combination).
- **Status** toggle (hide closed/planned by default).
- Active filters shown as removable chips; "Clear all" resets.
- Filter state is serialized to the URL for shareable views.

### Results list (`FacilityList`)
- Virtualized list of facilities matching current filters, sorted by name (or distance
  from map center).
- Each row: icon, name, category/subtype, designation, key capability badges.
- Click → select & fly-to.

### Facility detail (`FacilityDetail`)
- Header: name, category badge, agency, status.
- **Units/apparatus** table: type, designation, count, key attributes.
- **Specialties** as badges.
- **Category-specific attributes** (e.g. hospital trauma level & helipad; jail capacity &
  security level).
- **Mission Chief planning** callout: `game.building_types`, recommended flag, and
  `game.notes` — the "what to build" advice.
- **Significance** paragraph.
- **Sources** list with links + `confidence` + `last_verified` badge.
- Actions: copy coordinates, open in OpenStreetMap/Google Maps.

### Search
- Fuse.js fuzzy search over `name`, `agency.name`, `designation`, `specialties`, and
  `subtype`. Results reflect on both map and list.

### About / data page
- Explains data provenance, confidence model, how to request a new region, and how to
  contribute corrections via PR.

## Interaction & state

- **Single source of truth:** the loaded FeatureCollection + a filter/selection state.
- **URL-encoded state:** `region`, active filters, and `selected` id → deep-linkable and
  shareable ("here's the SWAT coverage in this city").
- **Keyboard:** list is arrow-navigable; `Esc` closes the detail panel.

## Accessibility & theming

- Meet WCAG AA contrast for markers, badges, and text in **both light and dark** themes.
  Category colors must be distinguishable for common color-vision deficiencies (pair color
  with distinct icons — never color alone).
- All controls keyboard-reachable and labeled; map has a list-based fallback for
  non-pointer users.

> When building any charts, category color palettes, stat tiles, or legends, follow the
> **dataviz** skill's guidance for a consistent, accessible color system.

## Visual language

- One accessible color per **service group** + a short code badge per `category`
  (see Map above); specialties shown as text/badges.
- Neutral, map-forward UI chrome so the data and markers dominate.
- Density-friendly typography — players scan a lot of stations at once.
