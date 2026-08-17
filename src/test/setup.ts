// Per-file setup for the `app` test project (see vite.config.ts).
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library auto-cleans only when `afterEach` is a global; this suite
// imports its test functions explicitly, so unmounting is wired up by hand.
afterEach(cleanup)

// jsdom has no layout, so it ships no scrollIntoView. FacilityList calls it to
// keep the selected row visible; a no-op is the honest stand-in (there is
// nothing to assert about scrolling in a zero-height document).
Element.prototype.scrollIntoView ??= () => {}
