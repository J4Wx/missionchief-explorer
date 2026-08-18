# 05 — Frontend & UX

## Layout

Two views share one frame. The app opens on the **global map** — every covered region as a
pin, and the region list beside it — and entering a region swaps the same two panes for
that region's facilities. The top bar is common to both, and its title is the way back out.

```
┌───────────────────────────────────────────────────────────────┐
│ Top bar: [Dispatch Atlas]  [Region ▾]  [Sub-region ▾]  [Search…] [About] │
├───────────────┬───────────────────────────────────────────────┤
│  Coverage      │            GLOBAL MAP (default view)          │
│  ─────────────  │      one pin per region, clustered where      │
│  UK      2     │      they overlap; click to enter one         │
│    Liverpool   │                                                │
│  US      3     │                                                │
│    Savannah…   │                                                │
└───────────────┴───────────────────────────────────────────────┘
```

Once a region is open (responsive → stacked on mobile):

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
- **The title returns to the global map**, clearing the region and its narrowing. It is the
  one control in the same place in both views, so "back out" never means the browser button.

## Views / components

### Global map (`GlobalMap`) — the default view
- Where the app opens, and where a URL with no `?region` lands (including one naming a
  region that doesn't exist — better an honest map of what *is* covered than someone
  else's city).
- One pin per published region, plotted from the registry's `center` — so the landing view
  costs **no region files**, holding the `docs/04` line that all regions never ship at once.
  The bubble carries the region's facility count and the label its name.
- **Regions cluster like facilities do.** Two cities an hour apart are the same point on a
  world map, so the source clusters and the bubble sums the facilities behind it, labeled
  "*n* regions"; clicking expands to the zoom that separates them, exactly as a facility
  cluster does. That is what keeps the view honest as the catalog grows past a handful.
- Clicking a region pin opens it. Hovering one highlights its row in the coverage list.
- Queued and in-progress regions are **not** pinned — the map shows what's covered; the
  About panel's coverage list is where the queue is public.

### Region browser (`RegionBrowser`)
- The global map's keyboard-reachable twin, in the place the results list occupies once a
  region is open — same bargain as map ↔ list within a region.
- The published regions grouped **country → division** by the same tree as the region
  picker (`src/lib/regionTree.ts`), each row a button carrying the region's facility count.
- Arrow keys move between rows; hover/focus highlights the matching pin.

### Could use a look (`StaleRegions`)
- Under the region browser on the landing view: the few published regions longest without a
  whole-region pass, from the registry's `last_reviewed` (docs/07 Phase 8) — so the ranking
  costs no region downloads.
- Framed as an invitation, not a warning. An old date means nobody has been back, not that
  the data is wrong; nothing here dims a region, hides it, or marks it untrustworthy.
- Each row: the region (opens it), how long it's been in plain language, and a **Request a
  review** link that opens the region-review issue form prefilled.
- Hidden below three published regions, where "the oldest" is most of the catalog and the
  ranking implies something it doesn't mean.

### Region picker
- Fed by `data/regions/index.json`; published entries only.
- **Nested**: a searchable listbox grouped **country → first-level division → region**
  ("United States › Georgia › Savannah"), built by `src/lib/regionTree.ts` from each
  entry's `country` + `admin`/`admin_name`. Country names come from `Intl.DisplayNames`,
  so the registry stores codes, not English labels.
- A division level that doesn't branch is left out — with one Merseyside region and
  nothing else British, it reads "United Kingdom › Liverpool"; the level appears the
  moment a second division does. Depth follows coverage instead of padding the tree.
- **Filter box** over the same tree, for when the list outgrows a glance. Matching is
  diacritic-folded (shared with facility search) and spans the region name, its ids and
  its group labels — so "georgia", "us ga" and "savannah" all find the same region, and
  a division still matches by name where the tree has collapsed it away. Groups with a
  surviving region are kept, so a filtered list keeps its bearings.
- Not a native `<select>`: that caps out at one level of `<optgroup>` and can't be
  filtered. It follows the ARIA combobox/listbox pattern instead — trigger with
  `aria-expanded`, ↑/↓/Home/End to move, Enter to choose, Esc to dismiss,
  `aria-activedescendant` for the active option, focus handed back to the trigger on
  close, and a click outside dismisses like a native menu.
- Selecting a region loads its GeoJSON and recenters the map to `metadata.center/zoom`.
- Persist last-used region in the URL (`?region=us-ga-savannah`); **no `region` param is
  the global map**, so the bare URL is the coverage view and every region link is explicit.

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
- The basemap under it — construction, the per-theme style swap, reduced-motion durations
  and the "no basemap" notice — is shared with the global map in `src/map/basemap.tsx`.
  Each map hands that hook the layers it wants installed; everything else is common.
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
- **Location** block: the address rendered in its own country's order via
  `src/lib/address.ts` — postcode after the region in the US, on its own line in the UK,
  leading the locality line elsewhere — with `county` carrying the local word ("Chatham
  County" vs "Merseyside"). The schema stores parts, never a formatted string.
- **Units/apparatus** table: type, designation, count, key attributes.
- **Specialties** as badges.
- **Category-specific attributes** (e.g. hospital trauma level & helipad; jail capacity &
  security level).
- **Mission Chief planning** callout: `game.building_types`, recommended flag, and
  `game.notes` — the "what to build" advice.
- **Significance** paragraph.
- **Sources** list with links + `confidence` + `last_verified` badge.
- **Report a correction** — opens the `02-data-correction.yml` issue form with this
  region, this facility and the title already filled in (`src/lib/links.ts`), so a wrong
  record is two clicks from a filed correction rather than a pull request.
- Actions: copy coordinates, open in OpenStreetMap/Google Maps.

### Search
- Fuse.js fuzzy search over `name`, `agency.name`, `designation`, `specialties`, and
  `subtype`. Results reflect on both map and list.
- **Diacritics are folded** on both the query and the indexed fields, so an ASCII keyboard
  finds accented names ("Munchen" → "München"). Letters that don't decompose under NFD
  (ß, ø, æ, œ, ł, đ, ð, þ) are spelled out.

### About / data page (`AboutPanel`)
- A dialog off the top bar, deep-linkable via `?about=1` so "where is this data from?"
  has a shareable answer.
- Explains data provenance, the confidence model, and how to contribute — linking the
  **Request a region** and **Report a correction** issue forms directly, with a PR as the
  alternative rather than the only path.
- Lists **coverage** straight from `index.json` — including `requested` and
  `in_progress` regions, so the queue is public — with each published region's review age
  and its own **Request a review** link, so any region can be sent for a deeper pass
  whether or not it looks stale.
- A provenance block for the region currently open: facility count, confidence split,
  `generated_by`/`generated_at`, when it was last reviewed as a whole, the distinct source
  domains it cites, and its **declared gaps** — what the region is known *not* to carry, so
  a blank space isn't read as "there is nothing there" (`metadata.coverage`, docs/03).
- Carries the attribution for OpenStreetMap, OpenFreeMap and MapLibre, and the
  "unofficial fan project" disclaimer.

## Interaction & state

- **Single source of truth:** the loaded FeatureCollection + a filter/selection state.
- **URL-encoded state:** `region`, active filters, and `selected` id → deep-linkable and
  shareable ("here's the SWAT coverage in this city"). No `region` is the global map, so
  there is no such thing as a "default" region to guess at.
- **Leaving a region** (the title, or picking another) clears the sub-region, filters and
  selection with it — they describe a region that is no longer open.
- **Keyboard:** list is arrow-navigable; `Esc` closes the detail panel.

## Accessibility & theming

**Themes.** Light and dark, following the OS by default with a three-way
light/system/dark control in the top bar (`ThemeToggle`) whose choice persists. The
active theme is a `data-theme` attribute on `<html>`, resolved by an inline script in
`index.html` before first paint so there's no flash of the wrong theme, and thereafter
owned by `src/lib/theme.ts`.

**Role tokens, not palette classes.** UI chrome is written against roles — `bg-surface`,
`bg-surface-2/3`, `text-ink`, `text-ink-muted`, `text-ink-faint`, `border-hairline`,
`text-accent` — defined once per theme as CSS custom properties in `src/index.css`. One
class works in both themes. Every ink level clears WCAG AA (≥ 4.5:1) against every
surface it can sit on, in both themes; hairlines are non-text separators. MapLibre's own
popups, controls and attribution are re-pointed at the same tokens.

**Category color is validated, not chosen.** One **mode-invariant** set of five
service-group colors (`src/lib/categories.ts`) that clears every dataviz gate on the
`--pairs all` pairlist against *both* surfaces — worst CVD ΔE 9.1 (above the ≥8 target,
not merely in the floor band), worst normal-vision ΔE 16.5, every step ≥3:1 on both
surfaces. This is possible because the dark lightness band sits inside the light one, so
steps chosen for dark satisfy both. Identity never rests on color alone regardless: the
per-category code badge is the second channel.

**Basemap per theme.** `VITE_MAP_STYLE` / `VITE_MAP_STYLE_DARK`. Swapping the style
discards everything the app added to the map, so the facility source and layers are
rebuilt on `style.load` and the current features, hover and selection re-applied.

**Keyboard & motion.**
- A skip link to the results list is the first tab stop; the list is the map's
  non-pointer equivalent, so that's where it lands — the region list on the global map,
  the facility list within a region.
- One `:focus-visible` outline everywhere, including MapLibre's injected controls.
- The detail and About panels take focus when they open (they cover the viewport on
  small screens) and hand it back to whatever opened them on close; `Esc` closes both.
- Camera fly/ease durations are zeroed under `prefers-reduced-motion`, and the CSS
  transition/animation reset applies globally.

> When building any charts, category color palettes, stat tiles, or legends, follow the
> **dataviz** skill's guidance for a consistent, accessible color system — and run its
> `validate_palette.js` rather than eyeballing the result.

## Visual language

- One validated color per **service group** + a short code badge per `category`
  (see Map above); specialties shown as text/badges. The group colors are identical in
  both themes — a marker means the same thing whichever theme you're in.
- Neutral, map-forward UI chrome so the data and markers dominate.
- Density-friendly typography — players scan a lot of stations at once.
