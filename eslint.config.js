// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/**', 'dist-e2e/**', 'node_modules/**', '.expo/**', 'test-results/**', 'playwright-report/**'],
  },
  {
    rules: {
      // All user-facing text must come from src/copy. JSX text literals are a strong signal of a violation.
      'react/jsx-no-literals': [
        'error',
        { noStrings: true, ignoreProps: true, allowedStrings: [] },
      ],
      // Props are the main path for user-facing strings (label, title, accessibilityLabel...).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name=/^(label|title|accessibilityLabel|accessibilityHint|placeholder)$/] > Literal',
          message: 'User-facing text must come from src/copy (use t()).',
        },
        {
          selector:
            'JSXAttribute[name.name=/^(label|title|accessibilityLabel|accessibilityHint|placeholder)$/] > JSXExpressionContainer > Literal',
          message: 'User-facing text must come from src/copy (use t()).',
        },
      ],
    },
  },
  {
    // Tests, the dev gallery (labels for tokens and states) and the copy module itself may use literals.
    files: [
      'src/copy/**',
      'src/app/dev/**',
      'src/dev/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      'e2e/**',
    ],
    rules: { 'react/jsx-no-literals': 'off', 'no-restricted-syntax': 'off' },
  },
]);
