import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Data lives in /data (outside src) and is loaded via import.meta.glob in
// src/data/regions.ts, so it stays the single source of truth and is bundled
// at build time. Base is set for project-page hosting; override via env if needed.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
})
