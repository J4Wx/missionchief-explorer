# Per-PR preview deploys on Laravel Forge

Two workflows manage an ephemeral Forge site for every pull request:

| Workflow | Trigger | Action |
| --- | --- | --- |
| `.github/workflows/forge-pr-preview.yml` | PR `opened`, `reopened`, `synchronize` — unless the PR only touches non-build files | Creates the site once, wires it to the PR branch, then deploys (and re-deploys on every push). |
| `.github/workflows/forge-pr-teardown.yml` | PR `closed`, or manual dispatch with a PR number | Deletes the site. |

Each PR gets its own site at `pr-<number>.<PREVIEW_BASE_DOMAIN>`.

## Required configuration

Add these under **Settings → Secrets and variables → Actions**.

**Secrets**

- `FORGE_API_TOKEN` — a Forge API token (Forge → Account → API).
- `FORGE_SERVER_ID` — numeric id of the Forge server that will host the previews.

**Variables**

- `PREVIEW_BASE_DOMAIN` — base domain for previews, e.g. `preview.dispatch-atlas.example`.
  Sites are created as `pr-123.preview.dispatch-atlas.example`.

## One-time infrastructure prerequisites

- **Wildcard DNS:** point `*.<PREVIEW_BASE_DOMAIN>` at the Forge server's IP so each
  new site resolves without manual DNS edits.
- **GitHub connected to Forge:** the server's Forge account must be connected to GitHub
  so the API can install repositories (Forge → Server → without this, the `git` install call fails).
- **Node on the server:** the deploy script runs `npm ci && npm run build`, so the Forge
  server needs Node.js installed (Forge → Server → Node).
- **TLS:** the preview workflow requests a per-site Let's Encrypt certificate on
  creation. This is best-effort — HTTP-01 issuance requires the site's DNS to already
  resolve to the server (see wildcard DNS above), so the cert may lag the first deploy
  by a minute or fail if DNS isn't ready. It can be re-issued from the Forge dashboard.

## How it works

- The site is created with `project_type: html` and web directory `/dist` — matching Vite's
  build output. The deploy script pulls the branch, installs deps, and runs `npm run build`.
- **Quick Deploy** is enabled on creation, so Forge also redeploys on direct pushes; the
  preview workflow additionally triggers an explicit deploy and waits for it to finish.
- **PRs that can't change the build are skipped.** A preview only exists to look at the
  built site, so the preview workflow carries a `paths-ignore` list: markdown at the repo
  root, `docs/`, the issue forms and `labels.yml`, `.devcontainer/`, `.vscode/`, and the
  git dot-files. Everything else — `src/`, `data/`, `schemas/`, `scripts/`, the build
  config — deploys. It is a denylist on purpose: a new source directory is previewed by
  default rather than silently skipped, and the cost of an unnecessary preview is lower
  than the cost of a missing one. `.github/workflows/` is deliberately *not* ignored, so a
  PR that edits these workflows can still exercise them.

  Two consequences worth knowing:

  - GitHub matches path filters against the PR's whole base…head diff, not the latest
    push. So a PR that touched `src/` keeps deploying on subsequent docs-only commits,
    and a PR that starts docs-only provisions its site on the first code commit — the
    provisioning steps run on `synchronize` too and are idempotent.
  - A workflow skipped by a path filter reports **no check at all**, not a green one.
    Don't make *Forge PR Preview* a required status check, or docs-only PRs will block
    forever waiting on a run that never starts.
- **Fork PRs are skipped.** GitHub does not expose secrets to `pull_request` runs from forks,
  so those PRs cannot (and should not, for safety) provision infrastructure.
- **Closed PRs are skipped.** Before provisioning anything, the preview workflow asks the
  API whether the PR is *currently* open, and skips the remaining steps if it isn't. This
  cannot be done from `github.event.pull_request.state`: a re-run replays the original
  event payload, so that field still reads `"open"` for a PR merged since. Without the
  live check, re-running a preview after a merge creates a site that teardown — which
  fires only on `pull_request: [closed]` — has already had its one chance to delete.
  A skipped run is green, not failed; a re-run against a closed PR is a no-op.

## Notes

- The workflows are idempotent: re-running on an existing PR reuses the existing site.
- **Re-running a preview is not free.** Unlike re-running CI, it acts on real
  infrastructure using possibly-stale event context. The open-PR gate above covers the
  known case, but treat a deploy re-run as a deliberate action.
- **The PR comment never fails the run.** Both workflows post their comment with
  `retries: 3` and `continue-on-error: true`. By the time it runs, the deploy (or the
  delete) has already happened, so failing the run over it would only invite a re-run of
  the infrastructure work — the chain that orphaned a site in the first place. A comment
  that could not be posted shows as a failed-but-ignored step, so check for one if a
  preview is live but unannounced.
- **Reaping an orphaned site.** If a `pr-<number>.…` site outlives its PR, run
  **Forge PR Teardown** from the Actions tab (*Run workflow* → PR number). It deletes the
  site by domain, so it works even when the PR closed long ago. Deleting the site by hand
  in the Forge dashboard also works.
