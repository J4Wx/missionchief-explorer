import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CORRECTION_TEMPLATE,
  REGION_REVIEW_TEMPLATE,
  REPO_URL,
  correctionUrl,
  issueUrl,
  reviewUrl,
} from './links'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('issueUrl', () => {
  it('points at the repo issue form named by the template', () => {
    const url = new URL(issueUrl('03-app-bug.yml'))
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`)
    expect(url.searchParams.get('template')).toBe('03-app-bug.yml')
  })

  it('carries prefill fields through, encoded', () => {
    const url = new URL(issueUrl('02-data-correction.yml', { region: 'gb-mersey-liverpool' }))
    expect(url.searchParams.get('region')).toBe('gb-mersey-liverpool')
  })

  it('follows VITE_REPO_URL so a fork points at itself', async () => {
    vi.stubEnv('VITE_REPO_URL', 'https://github.com/someone/fork')
    vi.resetModules()
    const forked = await import('./links')
    expect(forked.issueUrl('01-region-request.yml')).toBe(
      'https://github.com/someone/fork/issues/new?template=01-region-request.yml',
    )
  })
})

describe('correctionUrl', () => {
  // The field names are the `id`s in .github/ISSUE_TEMPLATE/02-data-correction.yml.
  // GitHub drops what it can't match, so a rename there empties the prefill
  // rather than erroring — hence pinning them.
  it('prefills the correction form with the region, facility and title', () => {
    const url = new URL(correctionUrl('us-sc-charleston', 'chs-station-3', 'Station 3'))
    expect(url.searchParams.get('template')).toBe(CORRECTION_TEMPLATE)
    expect(url.searchParams.get('region')).toBe('us-sc-charleston')
    expect(url.searchParams.get('facility')).toBe('chs-station-3 — Station 3')
    expect(url.searchParams.get('title')).toBe('[Correction] Station 3 (us-sc-charleston)')
  })

  it('escapes names that would otherwise break the query string', () => {
    const raw = correctionUrl('us-ga-savannah', 'ems-1', 'Chatham EMS #1 & Rescue')
    expect(raw).not.toContain('#1')
    expect(new URL(raw).searchParams.get('facility')).toBe('ems-1 — Chatham EMS #1 & Rescue')
  })
})

describe('reviewUrl', () => {
  // Field ids in .github/ISSUE_TEMPLATE/06-region-review.yml, and the same
  // prefill scripts/report.mjs writes into its --stale output.
  it('prefills the review form with the region and a titled subject', () => {
    const url = new URL(reviewUrl('us-ga-savannah', 'Savannah, GA (Chatham County)'))
    expect(url.searchParams.get('template')).toBe(REGION_REVIEW_TEMPLATE)
    expect(url.searchParams.get('region')).toBe('us-ga-savannah')
    expect(url.searchParams.get('title')).toBe('[Review] Savannah, GA (Chatham County)')
  })

  it('falls back to the region id when there is no display name', () => {
    const url = new URL(reviewUrl('us-ga-savannah'))
    expect(url.searchParams.get('title')).toBe('[Review] us-ga-savannah')
  })
})
