// Outbound links to the project itself. Kept in one place so a fork only has to
// change it here; override at build time with VITE_REPO_URL.
export const REPO_URL =
  (import.meta.env.VITE_REPO_URL as string | undefined) ??
  'https://github.com/J4Wx/missionchief-explorer'

/**
 * A prefilled GitHub issue-form link. `fields` keys are the `id`s in
 * .github/ISSUE_TEMPLATE/<template> — GitHub fills matching input/textarea
 * bodies and ignores anything it doesn't recognize, so a renamed field
 * degrades to an empty form rather than a broken link.
 */
export function issueUrl(template: string, fields: Record<string, string> = {}): string {
  const params = new URLSearchParams({ template, ...fields })
  return `${REPO_URL}/issues/new?${params}`
}

export const REGION_REQUEST_TEMPLATE = '01-region-request.yml'
export const CORRECTION_TEMPLATE = '02-data-correction.yml'

/**
 * "This record is wrong" for one facility, with the region, the facility and
 * the title already filled in — the reporter only has to write what's wrong
 * and cite it (docs/08 proposal C).
 */
export function correctionUrl(regionId: string, facilityId: string, name: string): string {
  return issueUrl(CORRECTION_TEMPLATE, {
    title: `[Correction] ${name} (${regionId})`,
    region: regionId,
    facility: `${facilityId} — ${name}`,
  })
}
