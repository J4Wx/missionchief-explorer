# Per-PR preview deploys on Laravel Forge

Two workflows manage an ephemeral Forge site for every pull request:

| Workflow | Trigger | Action |
| --- | --- | --- |
| `.github/workflows/forge-pr-preview.yml` | PR `opened`, `reopened`, `synchronize` | Creates the site once, wires it to the PR branch, then deploys (and re-deploys on every push). |
| `.github/workflows/forge-pr-teardown.yml` | PR `closed` | Deletes the site. |

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
- **Fork PRs are skipped.** GitHub does not expose secrets to `pull_request` runs from forks,
  so those PRs cannot (and should not, for safety) provision infrastructure.

## Notes

- The workflows are idempotent: re-running on an existing PR reuses the existing site.
- If a teardown is missed (e.g. the workflow was disabled), delete the `pr-<number>.…` site
  manually in the Forge dashboard.
