// Generates TypeScript types from the JSON Schemas so the app and data share a
// single source of truth. Run: npm run gen:types
import { compileFromFile } from 'json-schema-to-typescript'
import { mkdirSync, writeFileSync } from 'node:fs'

const banner =
  '/* AUTO-GENERATED from schemas/*.json by scripts/gen-types.mjs.\n' +
  '   Do not edit by hand — run `npm run gen:types` instead. */'

const ts = await compileFromFile('schemas/region.schema.json', {
  cwd: 'schemas', // resolve the facility.schema.json $ref
  bannerComment: banner,
  additionalProperties: false,
  declareExternallyReferenced: true,
  style: { singleQuote: true, semi: false },
})

mkdirSync('src/types', { recursive: true })
writeFileSync('src/types/schema.ts', ts)
console.log('Wrote src/types/schema.ts')
