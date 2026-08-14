import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // `.vite` is Vite's dependency cache (gitignored); `schema.ts` is generated.
  { ignores: ['dist', '.vite', 'src/types/schema.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    // The map component leans on effects heavily; the hooks rules keep the
    // deliberate dependency omissions explicit rather than silent.
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
)
