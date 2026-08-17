# 08 — Phase Proposals

> **Status: proposed, not committed.** Phases 0–5 in [07 — Roadmap](07-roadmap.md) are
> done. This doc is the candidate slate for what comes after, written so each item can be
> approved, deferred, or dropped on its own. **Approved items move into `docs/07` as
> numbered phases** (with their scope/exit criteria) and get struck from here; the rest
> stay as a backlog. Nothing here changes the vision or the non-goals in
> [01 — Vision & Scope](01-vision-and-scope.md).
>
> Proposals are lettered, not numbered — a phase number is assigned when one is approved,
> so the letters here never imply a schedule.
>
> **Already promoted out of this slate:** international region support (decision 2 below)
> is committed as **Phase 6** in `docs/07`, and the test foundation (proposal A) as
> **Phase 7**. Everything below is still a proposal, and B–F all assume Phase 6's
> `schema_version: 2` has landed first.
>
> **Partly landed:** the contribution-intake half of **C** (issue forms, the correction
> deep link, `.github/labels.yml` and its sync workflow) shipped on 2026-08-17 without
> waiting for the phase — it's small, standalone, and unblocks corrections now. Ticked
> items under C say what's done; the rest of C stands.

## Where the product actually stands

The app is done enough that the bottleneck has moved from *features* to *data depth and
contribution throughput*. Measured against the two published real regions (Savannah +
Charleston, 201 facilities):

| Signal | Now | Why it matters |
| --- | --- | --- |
| Fire/EMS facilities with ≥1 sourced unit | **65 / 127 (51%)** | "What runs from this house" is the headline value (`docs/06`) — it's missing for half the stations. |
| Facilities with any `specialties` tag | **45 / 201 (22%)** | Specialties drive the filters players plan with. |
| Hospitals with a `trauma_level` attribute | **6 / 15** | Trauma level gates in-game patient delivery. |
| Confidence distribution | 23 high / 138 medium / 40 low | Honest, but weighted toward "found the building, not the roster". |
| ~~Automated tests~~ | ~~**none**~~ → 247, in CI | **Closed by Phase 7.** No end-to-end path though — see the dropped Playwright item. |
| Source-link rot / staleness detection | none | Every record has `last_verified`, nothing ever re-checks it. |
| Contribution path for a non-coder | **issue forms** | Five forms, correction prefilled from the detail panel (part of C, landed 2026-08-17). What arrives is still triaged and merged by hand. |
| Cross-region view | none | One region at a time; no global map or search. |

Two structural facts constrain everything below: **no backend** (static site, static
data) and **"never ship all regions to the client at once"** (`docs/04`). Every proposal
here respects both.

## The slate

| # | Proposal | Value | Effort | Depends on |
| --- | --- | --- | --- | --- |
| ~~A~~ | ~~Test & regression foundation~~ | **Approved — Phase 7 in `docs/07`** | — | — |
| B | Data-depth pass + quality gates | **Highest** (core promise) | M | A for gates |
| C | Freshness, link rot & community corrections | High | M *(intake half landed)* | — |
| D | Build-plan output (schema v2 `game` vocab) | **Highest** (product thesis) | M | B helps |
| E | Multi-region scale & cross-region index | Medium–High | M–L | A, C |
| F | Coverage-gap & proximity overlay | Medium (novel) | M | E optional |

**Recommended order:** ~~A~~ → B → D → C → E → F. A first because everything after
it edits shared logic; B and D before E because scaling to twenty thin regions is
worth less than two deep ones plus a real planning payoff. C can run in parallel with
anything — and with its issue forms and labels already in, what's left of it is CI.

---

## ~~A — Test & regression foundation~~

**Approved and delivered — see [Phase 7 in `docs/07`](07-roadmap.md#phase-7--test--regression-foundation-)**
for what shipped. One item from the proposal was **not** taken:

- [ ] **Playwright happy path** — load region → filter → select facility → copy URL →
      reload restores the view, headless in CI. Dropped on the CI-budget decision (4
      below), which the proposal allowed for. Still worth doing: nothing currently
      exercises `App.tsx`, the map, or a real region file end to end, so the wiring
      *between* the tested modules is unguarded. Roughly ~1–2 min of CI per run.

---

## B — Data-depth pass + quality gates

**Why.** This is the gap between what the product promises and what it currently shows.
Half the fire/EMS houses have `units: []`, and only 22% of records carry a specialty tag.
The schema and the agent contract already forbid guessing, so the fix is a *second pass*
over published regions, not a schema change — plus a way to tell "unknown" apart from
"nobody looked yet", which today is indistinguishable.

**Scope**
- [ ] **Enrichment-pass contract** — an addendum to `docs/06` for a *depth* run over an
      already-published region: take the existing file, target `units: []` records and
      untagged specialties, work official apparatus rosters / trauma designations /
      capacity filings, raise `confidence`, bump `last_verified`. One PR per region, diff
      reviewable against the published file.
- [ ] **Declared gaps in region metadata** (additive schema bump, following Phase 6's
      version 2): a
      `metadata.coverage` block recording what was searched and what is *known* to be
      uncovered (e.g. Charleston's tow operators and 911 centers — currently prose in an
      `index.json` note). Lets the UI say "not covered here" instead of implying absence.
- [ ] **`scripts/report.mjs` (`npm run report`)** — per-region and total coverage
      metrics: unit coverage by category, specialty tagging, confidence mix, trauma-level
      completeness, records past a staleness threshold. Prints a table; emits JSON for CI.
- [ ] **Quality gates in CI** — warn (not fail) below thresholds; fail on regressions
      against the committed report baseline, so a new region can't dilute coverage
      silently.
- [ ] **Data-quality scorecard in the About panel** — per-region coverage/confidence
      readout next to the existing provenance, plus declared gaps.
- [ ] Depth pass executed on both published regions.

**Exit:** ≥80% of fire/EMS facilities in every published region either carry ≥1 sourced
unit or fall under a declared gap; hospitals all carry trauma level or an explicit
unknown; `npm run report` is the number both CI and the About panel read.

---

## C — Freshness, link rot & community corrections

> **Partly landed (2026-08-17), outside a phase.** The contribution-intake half is done —
> issue forms, the correction deep link, and the label set behind them (see the ticked
> items). The freshness half — link checking, staleness detection, request-to-queue
> automation — is untouched and still the reason this proposal exists.

**Why.** "Every claim has a source" only holds while the sources resolve. 201 records
cite ~35 hosts of department pages and PDFs; those rot. Meanwhile the only correction
path is a pull request, which excludes almost every player who'd notice a wrong roster.
This is the stretch-list "community corrections workflow" plus the freshness half it
needs to be credible.

**Scope**
- [ ] **Scheduled source check** (`.github/workflows/data-health.yml`, weekly): resolve
      every `sources[].url` (tolerant HEAD/GET, rate-limited, allowlist for hosts that
      block bots), and flag records whose `last_verified` is older than the agreed window
      (proposed: 12 months). Opens/updates one tracking issue with a re-verify worklist —
      never edits data automatically. The `stale-data` label it should apply already
      exists.
- [ ] **`npm run check-links`** locally, same code path.
- [x] **Issue forms** — `.github/ISSUE_TEMPLATE/` carries five: region request, data
      correction, app bug, feature/idea, and schema/vocabulary addition. The correction
      form is deep-linked from `FacilityDetail` with region, facility and title prefilled
      (`correctionUrl()` in `src/lib/links.ts`), and `AboutPanel` links the region-request
      and correction forms directly. Every form that asks for a data change requires a
      source.
- [x] **Label set as code** — `.github/labels.yml` is the source of truth (GitHub silently
      drops labels an issue form names but the repo doesn't have), synced by
      `scripts/sync-labels.mjs` / `npm run labels` from `.github/workflows/labels.yml`:
      dry-run on pull requests, apply on main, `--prune` only on manual dispatch.
- [ ] **Region requests → queue**: a workflow that turns an approved request issue into an
      `index.json` entry via `scripts/new-region.mjs` (`status: requested`), keeping the
      script as the only writer of that file. The form now collects what that workflow
      needs — region name, country, edition, and a suggested `region_id`.
- [ ] **PR template** with the data checklist from `AGENTS.md` (validate, cite, no
      fabrication, one region per PR).
- [ ] **Freshness surfaced in the UI** — *partly there since Phase 2/5*: the detail panel
      already shows `Verified <date>` next to the confidence badge, and the About panel
      shows the region's `generated_at`. What's missing is the region-level "as of" read
      and any visual distinction for a record past the staleness window — today stale and
      fresh look identical.

**Exit:** a broken source URL or a record past the staleness window shows up in a tracking
issue without a human noticing first; a non-coder can file a correction against a specific
facility in two clicks.

---

## D — Build-plan output

**Why.** The product thesis is planning, but the planning payoff is currently per-facility
prose: 143 detail panels and a filter panel. Nothing rolls up. A player who wants "what do
I build, in what order, to mirror Charleston" has to read the whole region. The data to
answer that is already there — `game.building_types`, `game.recommended` (36 records),
`staffing_model`, `units`, `specialties` — it just isn't aggregated.

Blocker: `game.building_types` is free strings (16 distinct values across two regions,
already drifting — `Tow` vs `Fire Station` vs `Small Fire Station`). Roll-ups need a
controlled vocabulary.

**Scope**
- [ ] **Schema v2 (additive):** controlled vocabulary for `game.building_types`, mapped in
      `docs/02` alongside the existing guidance table; validator enforces it; existing
      files migrated in the same PR. Keep `game.notes` free text.
- [ ] **Build-plan panel** for the current view (region, sub-region, or filtered set):
      counts per in-game building type, recommended-first ordering, the specialty
      coverage the region implies (HazMat, SWAT, aerial, trauma levels, marine), and the
      gaps a naive build would leave.
- [ ] **Export** — Markdown and CSV download, plus a print stylesheet, since players read
      this next to the game on a second screen.
- [ ] **Deep-linkable** (`?plan=1`) and respecting the active filters, consistent with the
      existing URL-state model.
- [ ] *Optional, client-only:* mark facilities as "built" in `localStorage` so the plan
      shows what's left. No accounts, no server — consistent with the v1 non-goals.

**Exit:** from a region view, a player gets an ordered, exportable build checklist keyed
to in-game buildings without opening a single detail panel.

---

## E — Multi-region scale & cross-region index

**Why.** Two real regions. Adding more is already routine (`new-region`, one PR each), so
this phase is about the parts that *don't* scale: there's no way to see what's covered
without opening the picker, no cross-region search, and no guard on payload size — while
`docs/04` forbids shipping all regions to the client.

**Scope**
- [ ] **Build-time slim index** — a generated `search-index.json` (id, name, category,
      agency, region, coords only; a few KB per region) so cross-region search and a
      global map work without downloading full region files. Generated by a script,
      validated in CI, never hand-edited.
- [ ] **Global coverage map** — the landing view when no region is selected: region
      markers with facility counts and status (published / in progress / requested),
      click to enter a region.
- [ ] **Cross-region search** — matches feed into the right region's deep link.
- [ ] **Payload budget in CI** — fail on a region file over the `docs/04` target (~1–2 MB)
      or a bundle regression, with the "split large metros by sub-area" guidance applied.
- [ ] **Batch generation runbook** — queue → agent run → per-region PR, using the existing
      `--batch` support; target set of ~10 regions chosen for variety (a large metro, a
      rural county, a volunteer-heavy area) rather than whatever's easiest.
- [ ] Regions published to hit that target.

**Exit:** cross-region search and a global coverage map work with no full-data download;
~10 published regions; CI fails on an oversized region file.

---

## F — Coverage-gap & proximity overlay

**Why.** The stretch list's siting aid, and the one feature that turns the catalog into a
decision tool. Real isochrones need a routing service — a backend dependency and an API
key the project deliberately avoids — so the proposal is the honest client-side
approximation first, with routed isochrones parked.

**Scope**
- [ ] **Distance-to-nearest-station surface** — a grid heat layer over the region for a
      chosen category (fire, EMS, hospital), computed client-side from the loaded region.
- [ ] **Coverage rings** — per-facility radius overlay with a category-appropriate default
      and a user control.
- [ ] **Gap list** — ranked under-served sub-regions, with a "site a station here" readout
      that feeds the D build plan.
- [ ] **Honest labeling** — straight-line distance, not routed drive time; stated in the
      UI and the About panel. This project is explicitly *not* authoritative for
      operational use (`docs/01`), and a coverage map is exactly where that could be
      misread.
- [ ] Reduced-motion and color-vision constraints from Phase 5 respected — the heat scale
      needs its own validated sequential palette, and it must not collide with the five
      service-group colors.

**Exit:** a player can see under-served areas for a category and get a suggested siting
readout, with the straight-line caveat visible where the overlay is.

---

## Parked (not proposed now)

| Item | Why parked |
| --- | --- |
| Routed drive-time isochrones | Needs a routing API + key; breaks zero-backend/no-key. Revisit only if F proves demand. |
| PWA / offline | Nice for second-screen play, no evidence anyone's asked; cheap to add later. |
| SEO prerender, sitemap, OG images | Niche audience reached via game forums, not search. |
| ~~Non-US regions~~ | **Approved** — now Phase 6 in `docs/07`. |
| User accounts / server-side editing | Explicit v1 non-goal (`docs/01`); the localStorage "built" tracker in D covers the useful part without it. |
| UI translation (i18n) | Explicitly out of Phase 6's scope — it internationalizes the data model, not the interface. Worth revisiting once a non-English region is published. |

## Decisions needed before these are scheduled

1. **Depth vs breadth.** B/D (make two regions excellent and actionable) before E
   (many regions), or the reverse? The recommendation above is depth-first; breadth-first
   is defensible if the goal is attracting contributors.
2. ~~**Non-US scope.**~~ **Decided: on the roadmap, and next.** The schema leans US
   (`address.state` required, ACS trauma levels, a category vocab built around
   sheriff/state/federal LE), so this is a schema and domain-model phase rather than a
   data PR — see **Phase 6** in `docs/07` for the scope. The target is the **UK edition**
   (one of the 24 listed in `docs/02` § Editions); UI translation is explicitly out of that
   phase's scope. Two knock-ons for this slate:
   - Phase 6 claims `schema_version: 2`, so **D**'s controlled `game.building_types`
     vocabulary becomes version 3 unless the two ship together.
   - **E**'s region target should be set after Phase 6, so it can include a non-US metro.
3. **Staleness window.** C proposes 12 months for `last_verified` before a record is
   flagged. Fire apparatus moves more often than jails; a per-category window is possible
   but more machinery.
4. **CI budget.** ~~A's Playwright job~~ and C's weekly link check both add CI minutes.
   **Decided for A (2026-08-17): Playwright dropped**, so Phase 7 added only the Vitest
   step (~15s). The question is still open for C's weekly link check, and for reviving
   Playwright later.
