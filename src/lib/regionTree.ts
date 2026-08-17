// Shapes the flat region registry into the country → division → region tree the
// region picker navigates, and filters that tree by a search query.
//
// The registry is flat by design (it is also the request queue), so the
// hierarchy is derived here from `country` + `admin` rather than stored.
import type { RegionIndexEntry } from '../types/app'
import { fold } from './search'

/** One step of the path down to a region: a country or a division. */
export interface Crumb {
  label: string
  /** Short form — "US", "GA". */
  code: string
}

/** A selectable region — always a leaf. */
export interface RegionLeaf {
  kind: 'region'
  entry: RegionIndexEntry
  /** The groups above it, outermost first. */
  path: Crumb[]
  /** Folded name + path + ids, i.e. everything `matches` searches. */
  haystack: string
}

/** A country or a first-level division within one. */
export interface RegionGroup {
  kind: 'group'
  /** Unique within the tree; the country code, or `<country>/<admin>`. */
  id: string
  label: string
  /** Short form for the label — "US", "GA". */
  code: string
  children: RegionNode[]
  /** Regions below this group, at any depth. */
  count: number
}

export type RegionNode = RegionGroup | RegionLeaf

const displayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

/** "GB" → "United Kingdom", falling back to the code itself. */
export function countryLabel(code: string): string {
  const upper = code.toUpperCase()
  try {
    return displayNames?.of(upper) ?? upper
  } catch {
    // `of` throws on anything that isn't a well-formed region code.
    return upper
  }
}

const byLabel = (a: { label: string }, b: { label: string }) =>
  a.label.localeCompare(b.label)

const nameOf = (node: RegionNode) => (node.kind === 'group' ? node.label : node.entry.name)

const sortNodes = (nodes: RegionNode[]) =>
  [...nodes].sort((a, b) => nameOf(a).localeCompare(nameOf(b)))

// The division a region belongs to stays searchable even where the picker
// collapses that level away, so "georgia" finds Savannah either way.
function leaf(entry: RegionIndexEntry, path: Crumb[]): RegionLeaf {
  const words = [
    entry.name,
    entry.region_id,
    entry.admin ?? '',
    entry.admin_name ?? '',
    ...path.flatMap((c) => [c.label, c.code]),
  ]
  return { kind: 'region', entry, path, haystack: fold(words.join(' ')) }
}

/**
 * Group the registry into countries and their divisions.
 *
 * A division level that doesn't branch is left out: if every region in a
 * country sits in the same division (or declares none), its regions hang
 * straight off the country — "GB › Liverpool", not "GB › Merseyside ›
 * Liverpool" — and the level appears as soon as a second division does.
 */
export function buildRegionTree(entries: RegionIndexEntry[]): RegionNode[] {
  const countries = new Map<string, RegionIndexEntry[]>()
  for (const entry of entries) {
    const code = entry.country.toUpperCase()
    countries.set(code, [...(countries.get(code) ?? []), entry])
  }

  const tree: RegionGroup[] = []
  for (const [code, inCountry] of countries) {
    const country: Crumb = { label: countryLabel(code), code }

    // Keyed by the admin code; regions without one share the empty-string key,
    // which never gets a group of its own.
    const divisions = new Map<string, RegionIndexEntry[]>()
    for (const entry of inCountry) {
      const key = entry.admin?.toLowerCase() ?? ''
      divisions.set(key, [...(divisions.get(key) ?? []), entry])
    }

    const branches = [...divisions.keys()].filter((key) => key !== '')
    const children: RegionNode[] =
      branches.length > 1
        ? [...divisions].flatMap<RegionNode>(([key, group]) => {
            if (key === '') return group.map((e) => leaf(e, [country]))
            const division: Crumb = {
              label: group.find((e) => e.admin_name)?.admin_name ?? key.toUpperCase(),
              code: key.toUpperCase(),
            }
            return [
              {
                kind: 'group' as const,
                id: `${code}/${key}`,
                label: division.label,
                code: division.code,
                count: group.length,
                children: sortNodes(group.map((e) => leaf(e, [country, division]))),
              },
            ]
          })
        : inCountry.map((e) => leaf(e, [country]))

    tree.push({
      kind: 'group',
      id: code,
      label: country.label,
      code,
      count: inCountry.length,
      children: sortNodes(children),
    })
  }

  return tree.sort(byLabel)
}

/** Whether a region matches `tokens` — every token must appear somewhere. */
function matches(node: RegionLeaf, tokens: string[]): boolean {
  return tokens.every((t) => node.haystack.includes(t))
}

/**
 * The tree narrowed to the regions matching `query`. Groups are kept whenever
 * something below them matched, so a filtered list keeps its bearings; a blank
 * query returns the tree untouched. Matching is diacritic-folded (`lib/search`)
 * and spans the region name, its ids and its group labels — "georgia", "us ga"
 * and "savannah" all find the same region.
 */
export function filterRegionTree(nodes: RegionNode[], query: string): RegionNode[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return nodes

  const narrow = (list: RegionNode[]): RegionNode[] =>
    list.flatMap<RegionNode>((node) => {
      if (node.kind === 'region') return matches(node, tokens) ? [node] : []
      const children = narrow(node.children)
      return children.length > 0 ? [{ ...node, children, count: countRegions(children) }] : []
    })

  return narrow(nodes)
}

function countRegions(nodes: RegionNode[]): number {
  return nodes.reduce((n, node) => n + (node.kind === 'region' ? 1 : node.count), 0)
}

/** Every region in the tree, in display order — the picker's keyboard order. */
export function flattenRegions(nodes: RegionNode[]): RegionLeaf[] {
  return nodes.flatMap((node) => (node.kind === 'region' ? [node] : flattenRegions(node.children)))
}
