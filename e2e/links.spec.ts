import { expect, test } from '@playwright/test';

import { runWithTeemux } from '../src/testing/runWithTeemux.js';

test.describe('URL linkification', () => {
  test('converts http URLs to clickable links', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Visit http://example.com for more info');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Check for anchor tag
      const link = page.locator('a[href="http://example.com"]');
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('target', '_blank');
    });
  });

  test('converts https URLs to clickable links', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Secure site: https://example.com/path');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      const link = page.locator('a[href="https://example.com/path"]');
      await expect(link).toHaveCount(1);
    });
  });

  test('converts file:// URLs to clickable links', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Open file:///Users/test/file.txt');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      const link = page.locator('a[href="file:///Users/test/file.txt"]');
      await expect(link).toHaveCount(1);
    });
  });

  test('handles URLs with port numbers', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Server at http://localhost:3000/api');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      const link = page.locator('a[href="http://localhost:3000/api"]');
      await expect(link).toHaveCount(1);
    });
  });

  test('strips trailing punctuation from URLs', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'Check http://example.com.');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // URL should not include the trailing period
      const link = page.locator('a[href="http://example.com"]');
      await expect(link).toHaveCount(1);
    });
  });

  test('multiple URLs in one line', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'See http://a.com and http://b.com');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      await expect(page.locator('a')).toHaveCount(2);
    });
  });
});
