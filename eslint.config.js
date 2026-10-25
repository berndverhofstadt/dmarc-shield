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
        { name: 'XMLHttpRequest', message: 'Network access is only allowed in src/dns.' },
        { name: 'WebSocket', message: 'Network access is not allowed.' },
        { name: 'EventSource', message: 'Network access is not allowed.' },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/dns/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Network access is only allowed in src/dns.' },
        { name: 'XMLHttpRequest', message: 'Network access is only allowed in src/dns.' },
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
