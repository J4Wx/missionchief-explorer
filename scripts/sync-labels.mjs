// Syncs the label set in .github/labels.yml to the GitHub repository, so the
// labels the issue forms apply actually exist (GitHub drops unknown labels
// from a form silently). Creates what's missing, updates colors/descriptions
// that drifted, and — only with --prune — deletes labels the file doesn't
// declare.
//
// Run: npm run labels -- --dry-run     (locally, no token needed for a public repo)
//      npm run labels                  (needs GITHUB_TOKEN with issues:write)
// Also runs from .github/workflows/labels.yml on pushes that touch the file.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const LABELS_PATH = '.github/labels.yml'
const API = 'https://api.github.com'
const COLOR_PATTERN = /^[0-9a-f]{6}$/
// GitHub truncates label descriptions past 100 characters.
const MAX_DESCRIPTION = 100

const USAGE = `
Sync .github/labels.yml to the repository's labels.

Usage:
  npm run labels [-- options]

Options:
  --dry-run          print what would change and exit; makes no writes
  --prune            delete labels that .github/labels.yml doesn't declare
  --repo <owner/name> target repository (default: GITHUB_REPOSITORY, else the
                     origin remote)
  --help             show this

Auth: GITHUB_TOKEN (or GH_TOKEN) with issues:write. A dry run against a public
repository works without one.
`

function parseArgs(argv) {
  const args = { dryRun: false, prune: false, repo: null }
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--help' || token === '-h') args.help = true
    else if (token === '--dry-run') args.dryRun = true
    else if (token === '--prune') args.prune = true
    else if (token === '--repo') args.repo = argv[++i]
    else {
      console.error(`Unknown argument: ${token}`)
      process.exit(2)
    }
  }
  return args
}

/** owner/name from the flag, the Actions environment, or the origin remote. */
function resolveRepo(flag) {
  if (flag) return flag
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
    }).trim()
    const match = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/)
    if (match) return match[1]
  } catch {
    // No git, no remote — fall through to the error below.
  }
  console.error('Could not determine the repository. Pass --repo owner/name.')
  process.exit(2)
}

function readLabels() {
  const declared = parse(readFileSync(LABELS_PATH, 'utf8'))
  if (!Array.isArray(declared)) {
    console.error(`✗ ${LABELS_PATH} must be a list of labels.`)
    process.exit(1)
  }

  const seen = new Set()
  let errors = 0
  const fail = (msg) => {
    errors++
    console.error(`  ✗ ${msg}`)
  }

  for (const label of declared) {
    const name = label?.name
    if (typeof name !== 'string' || name.length === 0) {
      fail(`every label needs a name (${JSON.stringify(label)})`)
      continue
    }
    if (seen.has(name.toLowerCase())) fail(`duplicate label: ${name}`)
    seen.add(name.toLowerCase())
    if (!COLOR_PATTERN.test(label.color ?? ''))
      fail(`${name}: color must be 6 hex digits without '#' (got ${label.color})`)
    if (typeof label.description !== 'string' || label.description.length === 0)
      fail(`${name}: needs a description`)
    else if (label.description.length > MAX_DESCRIPTION)
      fail(`${name}: description is ${label.description.length} chars (max ${MAX_DESCRIPTION})`)
  }

  if (errors > 0) {
    console.error(`\n${LABELS_PATH} is invalid — ${errors} problem(s).`)
    process.exit(1)
  }
  return declared
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || null

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'dispatch-atlas-label-sync',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`${method} ${path} → ${res.status} ${res.statusText}\n${detail}`)
  }
  return res.status === 204 ? null : res.json()
}

async function fetchExisting(repo) {
  const labels = []
  for (let page = 1; ; page++) {
    const batch = await api('GET', `/repos/${repo}/labels?per_page=100&page=${page}`)
    labels.push(...batch)
    if (batch.length < 100) return labels
  }
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(USAGE)
  process.exit(0)
}

const repo = resolveRepo(args.repo)
const declared = readLabels()
console.log(`${LABELS_PATH}: ${declared.length} labels declared, syncing to ${repo}`)

if (!token && !args.dryRun) {
  console.error('✗ GITHUB_TOKEN (or GH_TOKEN) is required to write labels.')
  process.exit(2)
}

let existing
try {
  existing = await fetchExisting(repo)
} catch (err) {
  console.error(`✗ Could not read the repository's labels: ${err.message}`)
  if (!token) console.error('A private repository needs GITHUB_TOKEN even for a dry run.')
  process.exit(1)
}

const byName = new Map(existing.map((l) => [l.name.toLowerCase(), l]))
const plan = { create: [], update: [], prune: [], unchanged: 0 }

for (const label of declared) {
  const current = byName.get(label.name.toLowerCase())
  if (!current) plan.create.push(label)
  else if (
    current.color.toLowerCase() !== label.color.toLowerCase() ||
    (current.description ?? '') !== label.description ||
    current.name !== label.name
  )
    plan.update.push({ label, current })
  else plan.unchanged++
}

const declaredNames = new Set(declared.map((l) => l.name.toLowerCase()))
for (const label of existing) {
  if (!declaredNames.has(label.name.toLowerCase())) plan.prune.push(label)
}

for (const l of plan.create) console.log(`  + ${l.name}`)
for (const { label, current } of plan.update)
  console.log(`  ~ ${label.name} (was #${current.color} "${current.description ?? ''}")`)
for (const l of plan.prune)
  console.log(args.prune ? `  - ${l.name}` : `  ! ${l.name} — not declared (use --prune to delete)`)
if (plan.unchanged > 0) console.log(`  = ${plan.unchanged} already in sync`)

if (args.dryRun) {
  console.log('\nDry run — nothing was changed.')
  process.exit(0)
}

try {
  for (const l of plan.create) {
    await api('POST', `/repos/${repo}/labels`, {
      name: l.name,
      color: l.color,
      description: l.description,
    })
  }
  for (const { label, current } of plan.update) {
    await api('PATCH', `/repos/${repo}/labels/${encodeURIComponent(current.name)}`, {
      new_name: label.name,
      color: label.color,
      description: label.description,
    })
  }
  if (args.prune) {
    for (const l of plan.prune) {
      await api('DELETE', `/repos/${repo}/labels/${encodeURIComponent(l.name)}`)
    }
  }
} catch (err) {
  console.error(`\n✗ Label sync failed: ${err.message}`)
  process.exit(1)
}

const pruned = args.prune ? plan.prune.length : 0
console.log(
  `\n✓ ${plan.create.length} created, ${plan.update.length} updated, ${pruned} deleted.`,
)
