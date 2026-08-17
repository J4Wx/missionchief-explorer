// Country-aware rendering of the `address` block.
//
// The schema stores address *parts*, never a formatted string (docs/03), because
// the order is a local convention: a US address ends "Savannah, GA 31401", a UK
// one puts the postcode on its own line after the post town, and most of Europe
// leads with it ("10115 Berlin"). None of this is a fact about a facility — it is
// presentation, so it lives here rather than in the data.
import type { Facility } from '../types/app'

type Address = Facility['address']

interface Convention {
  /** Where the postal code sits relative to the locality. */
  postcode: 'after_region' | 'before_city' | 'own_line'
  /**
   * The local word for a second-level area, appended to `county` for display
   * when it isn't part of the stored value: US data stores "Chatham" and reads
   * "Chatham County", while "Merseyside" takes no suffix at all.
   */
  countySuffix?: string
}

// Only countries that differ from the default need an entry.
const CONVENTIONS: Record<string, Convention> = {
  US: { postcode: 'after_region', countySuffix: 'County' },
  CA: { postcode: 'after_region' },
  AU: { postcode: 'after_region' },
  NZ: { postcode: 'after_region' },
  GB: { postcode: 'own_line' },
  IE: { postcode: 'own_line' },
}

// Most of the world leads the locality line with the postal code, so that is the
// fallback for a country nobody has recorded a convention for yet.
const DEFAULT_CONVENTION: Convention = { postcode: 'before_city' }

function conventionFor(country: string): Convention {
  return CONVENTIONS[country] ?? DEFAULT_CONVENTION
}

/**
 * The address as lines, in local order, with empty parts dropped. Returns lines
 * rather than a string so the caller decides how to join them — the UK's
 * postcode-on-its-own-line only reads correctly if the break survives.
 */
export function addressLines(a: Address): string[] {
  const convention = conventionFor(a.country)
  const city = a.city?.trim()
  const postcode = a.postal_code?.trim()
  const region = a.state?.trim()
  const lines: string[] = []

  if (a.street?.trim()) lines.push(a.street.trim())

  switch (convention.postcode) {
    case 'after_region': {
      // "Savannah, GA 31401" — and still correct if either part is missing.
      const tail = [region, postcode].filter(Boolean).join(' ')
      lines.push([city, tail].filter(Boolean).join(', '))
      break
    }
    case 'before_city': {
      lines.push([postcode, city].filter(Boolean).join(' '))
      if (region) lines.push(region)
      break
    }
    case 'own_line': {
      if (city) lines.push(city)
      if (region) lines.push(region)
      if (postcode) lines.push(postcode)
      break
    }
  }

  return lines.filter(Boolean)
}

/**
 * The second-level area with its local word applied — "Chatham County" in the
 * US, "Merseyside" in the UK — or null when none is recorded.
 */
export function countyLabel(a: Address): string | null {
  const county = a.county?.trim()
  if (!county) return null
  const suffix = conventionFor(a.country).countySuffix
  // Tolerate data that already spells the word out.
  if (!suffix || county.toLowerCase().endsWith(suffix.toLowerCase())) return county
  return `${county} ${suffix}`
}
