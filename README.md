# Dispatch Atlas

An interactive explorer for the real-world locations of emergency-services facilities —
**Fire, EMS, Police, Sheriff, State & Federal Law Enforcement, Hospitals, Prisons &
Jails, Tow depots/yards, Dispatch centers**, and more — built to help players plan their
builds and expansion in the dispatch-simulation game **Mission Chief**.

The platform lets you:

- **Browse** a normalized dataset of emergency-services facilities.
- **Map** those facilities, cluster them by area, and filter by category/agency/capability.
- **Drill in** on any facility to see the apparatus/units that run from it in the real
  world, its specialties (SWAT, HazMat, trauma level, etc.), and notes that matter for
  planning your in-game coverage.
- **Grow the dataset** by tasking an AI agent to research and generate a normalized data
  file for any city or region a player is interested in.

> **Status:** Planning / pre-implementation. This repository currently contains the
> project plan, data schema, agent instructions, and a sample data fixture. No
> application code has been written yet — see the [roadmap](docs/07-roadmap.md).

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
| [AGENTS.md](AGENTS.md) | Operating instructions for agents working in this repo. |

## Key artifacts

- **`schemas/facility.schema.json`** — JSON Schema for a single facility record.
- **`schemas/region.schema.json`** — JSON Schema for a region GeoJSON file.
- **`data/regions/index.json`** — registry of available regions.
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
```

The basemap defaults to [OpenFreeMap](https://openfreemap.org/) (no API key). Point
`VITE_MAP_STYLE` at any other MapLibre style URL to swap it.

See [04 — Architecture](docs/04-architecture.md) for the rationale behind these choices.
