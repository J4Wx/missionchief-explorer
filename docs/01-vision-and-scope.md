# 01 — Vision & Scope

## The problem

[Mission Chief](https://www.missionchief.com/) (US edition of *Leitstellenspiel*) is a
browser dispatch simulator: players build a network of emergency-services stations,
staff them with vehicles, and respond to a stream of procedurally generated missions.
Success depends heavily on **where** you place buildings and **which** specialized units
you stock — coverage gaps, missing HazMat/SWAT/aerial assets, or a hospital without the
right trauma capability all cost you missions.

Serious players want to mirror the **real-world** emergency-services layout of a city or
region: where the fire houses actually are, which engines/ladders run from them, where
the trauma centers and SWAT teams sit, where the county jail is, and so on. Today that
information is scattered across department websites, OpenStreetMap, Wikipedia, news
articles, and PDFs. There is no single place to explore it with a planning lens.

## The product

**Dispatch Atlas** is a website that presents a **normalized, map-first catalog** of
emergency-services facilities, curated for in-game planning. Data for any city/region is
produced on demand by an AI **data-generation agent** and committed as static files, so
the catalog grows region by region.

## Goals

1. **Map-first exploration.** Every facility has coordinates; the primary view is a map
   with clustering, category filters, and click-through detail.
2. **Planning-relevant depth.** Each facility records the things that change a player's
   decisions: apparatus/units, specialties, capacity, trauma level, and freeform
   "significance" notes.
3. **Normalized & queryable data.** A single schema across all facility categories so the
   UI, filters, and search work uniformly and data stays consistent between regions.
4. **Agent-extensible.** Adding a new region is "task the agent with a place name"; the
   agent researches, normalizes, cites sources, and outputs a schema-valid file.
5. **Zero-backend, low-cost.** Static site + static data. Cheap to host, trivial to fork,
   easy to contribute to via pull requests.
6. **Honest data.** Sources and a confidence level on every record; unknowns are recorded
   as unknown, never fabricated.

## Non-goals (initially)

- **Not** a live CAD/incident feed or anything tied to real active dispatches.
- **Not** a Mission Chief automation tool, bot, or account integration — it is a planning
  reference the player reads alongside the game.
- **No** user accounts, editing UI, or server-side database in v1 (data is edited as files
  via PRs / the agent).
- **Not** authoritative for operational/emergency use — it is a game-planning aid built
  from public, best-effort data.

## Target user

A Mission Chief player planning their department in a specific real city/region who wants
a faithful, browsable reference of what services really exist there and what runs from
each station.

## Guiding principles

- **Normalize once, render everywhere.** One record shape drives map, list, filters,
  search, and detail.
- **Every claim has a source.** No un-cited "facts"; confidence is explicit.
- **Game relevance is a first-class field**, not an afterthought — the whole point is
  planning.
- **Data is code.** It lives in the repo, is schema-validated in CI, and evolves via PRs.
- **Progressive coverage.** Ship one good region, then scale the agent to more.
