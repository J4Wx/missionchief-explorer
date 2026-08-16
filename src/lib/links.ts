// Outbound links to the project itself. Kept in one place so a fork only has to
// change it here; override at build time with VITE_REPO_URL.
export const REPO_URL =
  (import.meta.env.VITE_REPO_URL as string | undefined) ??
  'https://github.com/J4Wx/missionchief-explorer'
