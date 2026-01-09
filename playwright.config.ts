import { defineConfig } from '@playwright/test';

export default defineConfig({
  forbidOnly: Boolean(process.env['CI']),
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  reporter: process.env['CI'] ? 'dot' : 'list',
  retries: process.env['CI'] ? 2 : 0,
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:9950',
    trace: 'on-first-retry',
  },
  workers: 1, // Single worker to avoid port conflicts
});
