import { expect, test } from '@playwright/test';

import { runWithTeemux } from '../src/testing/runWithTeemux.js';

test.describe('highlighting', () => {
  test('highlights terms from highlight parameter', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'This message contains ERROR in it');

      await page.goto(`${ctx.url}?highlight=ERROR`, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Check for mark element
      await expect(page.locator('mark')).toHaveCount(1);
      await expect(page.locator('mark')).toContainText('ERROR');
    });
  });

  test('highlights multiple terms', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'User logged in successfully');

      await page.goto(`${ctx.url}?highlight=User,logged`, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Should have 2 highlighted terms
      await expect(page.locator('mark')).toHaveCount(2);
    });
  });

  test('highlight is case insensitive', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'ERROR occurred');

      await page.goto(`${ctx.url}?highlight=error`, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Should still highlight ERROR even though we searched for error
      await expect(page.locator('mark')).toHaveCount(1);
    });
  });

  test('filter matches are highlighted with filter class', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'ERROR: something failed');
      await ctx.injectLog('app', 'INFO: all good');

      await page.goto(`${ctx.url}?include=ERROR`, { waitUntil: 'commit' });
      await page.waitForSelector('.line');

      // Filter match should be highlighted with .filter class
      await expect(page.locator('mark.filter')).toHaveCount(1);
      await expect(page.locator('mark.filter')).toContainText('ERROR');
    });
  });

  test('highlight input updates highlighting dynamically', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Test message with keyword');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // No highlights initially
      await expect(page.locator('mark')).toHaveCount(0);

      // Type in highlight input
      await page.fill('#highlight', 'keyword');
      await page.waitForTimeout(100);

      // Should now have highlight
      await expect(page.locator('mark')).toHaveCount(1);
      await expect(page.locator('mark')).toContainText('keyword');
    });
  });
});
