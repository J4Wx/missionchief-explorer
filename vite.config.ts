import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Data lives in /data (outside src) and is loaded via import.meta.glob in
// src/data/regions.ts, so it stays the single source of truth and is bundled
// at build time. Base is set for project-page hosting; override via env if needed.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  // Two suites with different needs, so they run as separate projects rather
  // than one environment stretched over both: the app tests want a DOM and the
  // Testing Library setup, the script tests are plain Node and shouldn't pay
  // for jsdom (or load a setup file that imports React).
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.mjs'],
        },
      },
    ],
  },
})
