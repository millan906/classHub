import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'supabase/functions']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Async data fetching in useEffect is intentional throughout this project
      'react-hooks/set-state-in-effect': 'off',

      // SE practices: complexity and file-size guardrails
      // Cyclomatic complexity: warn at 10, error at 15
      'complexity': ['warn', { max: 10 }],
      // Max file length: warn at 300 lines, error at 500
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      // Max nesting depth
      'max-depth': ['warn', { max: 4 }],
      // Max function length
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
])
