# Dispatch Atlas

An interactive explorer for the real-world locations of emergency-services facilities —
**Fire, EMS, Police, Sheriff, State & Federal Law Enforcement, Hospitals, Prisons &
Jails, Tow depots/yards, Dispatch centers**, and more — built to help players plan their
builds and expansion in the dispatch-simulation game **Mission Chief**.

The platform lets you:

- **Start global** — the app opens on a world map of every covered region, with facility
  counts; click a pin (or the coverage list beside it) to drop into that region, and the
  title in the top bar to come back out.
- **Browse** a normalized dataset of emergency-services facilities.
- **Map** those facilities, cluster them by area, and filter by category/agency/capability.
- **Drill in** on any facility to see the apparatus/units that run from it in the real
  world, its specialties (SWAT, HazMat, trauma level, etc.), and notes that matter for
  planning your in-game coverage.
- **Grow the dataset** by tasking an AI agent to research and generate a normalized data
  file for any city or region a player is interested in.

> **Status:** Shipping. Phases 0–6 of the [roadmap](docs/07-roadmap.md) are complete — the
> app is built, validated in CI, deployed with per-PR previews, and the catalog is now
> **multi-country**: Savannah GA, Charleston SC, **Buffalo NY (Erie County)** and two UK
> regions — **Liverpool / Merseyside** and **Norwich / Norfolk** — alongside
> the fictional schema fixture. Adding regions is routine; see
> [CONTRIBUTING.md](CONTRIBUTING.md).
>
> Candidates for what comes next are in
> [08 — Phase Proposals](docs/08-phase-proposals.md) — the largest known gap is data *depth*
> (published apparatus rosters are thin), not coverage.

---

## Documentation index

| Doc | What it covers |
| --- | --- |
| [01 — Vision & Scope](docs/01-vision-and-scope.md) | Problem, goals, non-goals, target user, guiding principles. |
| [02 — Domain Model](docs/02-domain-model.md) | Real-world facility taxonomy and how each maps to Mission Chief buildings/vehicles. |
| [03 — Data Schema](docs/03-data-schema.md) | The normalized record format, field-by-field, plus controlled vocabularies. |
| [04 — Architecture](docs/04-architecture.md) | Tech stack, repo layout, data flow, build & hosting. |
| [05 — Frontend & UX](docs/05-frontend-ux.md) | Pages, map behavior, filtering, facility detail, components. |
| [06 — Data-Generation Agent](docs/06-data-generation-agent.md) | How the agent researches a region, its sources, guardrails, and output contract. |
| [07 — Roadmap](docs/07-roadmap.md) | Phased milestones from scaffold to shippable. |
| [08 — Phase Proposals](docs/08-phase-proposals.md) | Candidate phases awaiting approval, with the measured gaps behind each. |
| [AGENTS.md](AGENTS.md) | Operating instructions for agents working in this repo. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Requesting a region, correcting data, working on the app. |

## Key artifacts

- **`schemas/facility.schema.json`** — JSON Schema for a single facility record.
- **`schemas/region.schema.json`** — JSON Schema for a region GeoJSON file.
- **`data/regions/index.json`** — registry of available regions.
- **`data/regions/parts/<region_id>/`** — for a region too big to research in one pass, the
  manifest and per-borough files that `npm run merge-region` assembles into its region
  file ([docs/06](docs/06-data-generation-agent.md#regions-generated-in-parts)).
- **`data/regions/example-springfield.geojson`** — an illustrative (fictional) sample
  showing the shape of real data.

## Quickstart

The stack is **Vite + React + TypeScript + Tailwind + MapLibre GL**, deployed as a
static site. Data ships as static per-region GeoJSON files — there is no backend to run.

```bash
npm install
npm run dev        # local dev server
npm run validate   # validate all data files against the JSON Schema
npm run build      # produce static site in dist/

npm run new-region -- --help    # register or scaffold a region
```

The basemap defaults to [OpenFreeMap](https://openfreemap.org/) (no API key), one style
per theme. Point `VITE_MAP_STYLE` and `VITE_MAP_STYLE_DARK` at any other MapLibre style
URLs to swap them.

The app follows the OS light/dark setting by default, with an in-app override that
sticks. Facility markers are colored by **service group** and badged with a
per-category code, so nothing depends on color alone; the palette is validated for
color-vision deficiency in both themes rather than hand-picked (see
[CONTRIBUTING.md](CONTRIBUTING.md)).

See [04 — Architecture](docs/04-architecture.md) for the rationale behind these choices.

## Contributing

Requests and corrections are [issue forms](.github/ISSUE_TEMPLATE) — no pull request
needed. Every facility panel links a correction form with that region and facility
prefilled, and a source is all a fix needs. [CONTRIBUTING.md](CONTRIBUTING.md) covers the
rest, including generating a region.
