const globals = require('globals');
const pluginJs = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['src/**/*.ts']
  },
  pluginJs.configs.recommended,
  {
    plugins: { '@typescript-eslint': tseslint },
    languageOptions: { parser: tsParser },
    rules: { ...tseslint.configs.recommended.rules }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        Zotero: 'readonly',
        Services: 'readonly',
        PathUtils: 'readonly',
        Ci: 'readonly',
        Cc: 'readonly',
        Components: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
