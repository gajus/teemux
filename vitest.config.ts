import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/e2e/**', '**/node_modules/**'],
    singleThread: true,
    testTimeout: 5_000,
  },
});
