import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false, // Run tests sequentially to avoid port conflicts
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  timeout: 30_000,
  workers: 1, // Single worker to avoid port conflicts
  reporter: process.env['CI'] ? 'dot' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:9950',
    trace: 'on-first-retry',
  },
});
