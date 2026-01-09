import { expect, test } from '@playwright/test';

import { runWithTeemux } from '../src/testing/runWithTeemux.js';

test.describe('pinning', () => {
  test('pin button appears on hover', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Test log message');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Pin button should be hidden by default
      const pinBtn = page.locator('.pin-btn').first();
      await expect(pinBtn).toHaveCSS('opacity', '0');

      // Hover over the line
      await page.locator('.line').first().hover();

      // Pin button should become visible
      await expect(pinBtn).not.toHaveCSS('opacity', '0');
    });
  });

  test('clicking pin button pins the line', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Important message');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Click the pin button
      await page.locator('.line').first().hover();
      await page.locator('.pin-btn').first().click();

      // Line should have pinned class
      await expect(page.locator('.line').first()).toHaveClass(/pinned/);
    });
  });

  test('pinned lines remain visible when filtered out', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: should be hidden');
      await ctx.injectLog('app', 'ERROR: should stay visible');
      await ctx.injectLog('app', 'DEBUG: should be hidden');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(3);

      // Pin the ERROR line (second line)
      const errorLine = page.locator('.line').nth(1);
      await errorLine.hover();
      await errorLine.locator('.pin-btn').click();
      await expect(errorLine).toHaveClass(/pinned/);

      // Apply filter that would hide ERROR
      await page.fill('#include', 'INFO');
      await page.waitForTimeout(100);

      // ERROR line should still be visible because it's pinned
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(2); // INFO + pinned ERROR

      // Verify the pinned line is the ERROR one
      await expect(page.locator('.line.pinned')).toContainText('ERROR');
    });
  });

  test('unpinning a line respects current filter', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'INFO: message');
      await ctx.injectLog('app', 'ERROR: message');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(2);

      // Pin ERROR line
      const errorLine = page.locator('.line').nth(1);
      await errorLine.hover();
      await errorLine.locator('.pin-btn').click();

      // Filter to only show INFO
      await page.fill('#include', 'INFO');
      await page.waitForTimeout(100);

      // Both should be visible (INFO matches, ERROR is pinned)
      await expect(page.locator('.line:visible')).toHaveCount(2);

      // Unpin ERROR line
      await errorLine.hover();
      await errorLine.locator('.pin-btn').click();

      // Now ERROR should be hidden
      await page.waitForTimeout(100);
      await expect(page.locator('.line:visible')).toHaveCount(1);
      await expect(page.locator('.line:visible')).toContainText('INFO');
    });
  });
});
