// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const prettierConfig = require('eslint-config-prettier')
const prettierPlugin = require('eslint-plugin-prettier')

module.exports = defineConfig([
  expoConfig,
  // Apply prettier plugin to run Prettier as part of ESLint
  {
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      ...prettierPlugin.configs.recommended.rules,
      'prettier/prettier': 'warn'
    }
  },
  // This disables ESLint rules that conflict with Prettier
  prettierConfig,
  // Project-specific settings
  {
    ignores: ['dist/*']
  }
])
