import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, Office: 'readonly' } },
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'XMLHttpRequest',
          message: 'Network access is only allowed in src/dns and src/bimi/lookup.ts.',
        },
        { name: 'WebSocket', message: 'Network access is not allowed.' },
        { name: 'EventSource', message: 'Network access is not allowed.' },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    // The only modules allowed to make network requests (both opt-in).
    ignores: ['src/dns/**', 'src/bimi/lookup.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Network access is only allowed in src/dns and src/bimi/lookup.ts.',
        },
        {
          name: 'XMLHttpRequest',
          message: 'Network access is only allowed in src/dns and src/bimi/lookup.ts.',
        },
        { name: 'WebSocket', message: 'Network access is not allowed.' },
        { name: 'EventSource', message: 'Network access is not allowed.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'Network access is not allowed.' },
      ],
    },
  },
  {
    files: ['test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
);
