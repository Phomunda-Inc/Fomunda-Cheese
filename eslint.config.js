import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['.local/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['server.js', 'server.test.js', 'scripts/**/*.js', 'tools/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['app.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
];
