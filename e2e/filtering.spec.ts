import { expect, test } from '@playwright/test';

import { runWithTeemux } from '../src/testing/runWithTeemux.js';

test.describe('filtering', () => {
  test('shows all logs when no filter is applied', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: application started');
      await ctx.injectLog('app', 'ERROR: something failed');
      await ctx.injectLog('app', 'DEBUG: some debug info');

      await page.goto(ctx.url, { waitUntil: 'commit' });

      // Wait for logs to appear
      await expect(page.locator('.line')).toHaveCount(3);
    });
  });

  test('filters logs by include parameter in URL', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: application started');
      await ctx.injectLog('app', 'ERROR: something failed');
      await ctx.injectLog('app', 'DEBUG: some debug info');

      await page.goto(`${ctx.url}?include=ERROR`, { waitUntil: 'commit' });

      // Wait for all logs to be received (3 total, but only 1 visible)
      await expect(page.locator('.line')).toHaveCount(3);

      // Only ERROR line should be visible
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(1);
      await expect(visibleLines.first()).toContainText('ERROR');
    });
  });

  test('filters with multiple include terms (OR logic)', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: user logged in');
      await ctx.injectLog('app', 'ERROR: system error');
      await ctx.injectLog('app', 'DEBUG: something else');

      await page.goto(`${ctx.url}?include=INFO,ERROR`, { waitUntil: 'commit' });

      // Wait for all logs to be received
      await expect(page.locator('.line')).toHaveCount(3);

      // Lines with INFO OR ERROR should be visible (not DEBUG)
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(2);
    });
  });

  test('excludes logs by exclude parameter', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: application started');
      await ctx.injectLog('app', 'ERROR: something failed');
      await ctx.injectLog('app', 'DEBUG: verbose output');

      await page.goto(`${ctx.url}?exclude=DEBUG`, { waitUntil: 'commit' });

      // Wait for all logs to be received
      await expect(page.locator('.line')).toHaveCount(3);

      // DEBUG line should be hidden
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(2);

      // Verify none of the visible lines contain DEBUG
      for (const line of await visibleLines.all()) {
        await expect(line).not.toContainText('DEBUG');
      }
    });
  });

  test('filters using the UI input field', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: application started');
      await ctx.injectLog('app', 'ERROR: something failed');

      await page.goto(ctx.url, { waitUntil: 'commit' });

      // Wait for logs to appear
      await expect(page.locator('.line')).toHaveCount(2);

      // Type in the filter input
      await page.fill('#include', 'ERROR');

      // Wait for filter to apply
      await page.waitForTimeout(100);

      // Only ERROR line should be visible
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(1);
      await expect(visibleLines.first()).toContainText('ERROR');
    });
  });

  test('filter is case insensitive', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'ERROR: something failed');
      await ctx.injectLog('app', 'error: lowercase error');

      await page.goto(`${ctx.url}?include=error`, { waitUntil: 'commit' });

      // Wait for all logs to be received
      await expect(page.locator('.line')).toHaveCount(2);

      // Both lines should match (case insensitive)
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(2);
    });
  });
});
