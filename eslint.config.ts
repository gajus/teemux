import auto from 'eslint-config-canonical/auto';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  auto,
  {
    ignores: [
      'dist',
      'package-lock.json',
      'pnpm-lock.yaml',
      'scripts',
      'src/client/styled-system',
      'src/client/vite.config.ts',
      'test-results',
    ],
  },
]);
