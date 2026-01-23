import auto from 'eslint-config-canonical/auto';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  auto,
  {
    ignores: [
      'dist',
      'pnpm-lock.yaml',
      'src/client/styled-system',
      'test-results',
    ],
  },
]);
