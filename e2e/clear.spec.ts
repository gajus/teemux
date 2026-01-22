import { runWithTeemux } from '../src/testing/runWithTeemux.js';
import { expect, test } from '@playwright/test';

test.describe('clear logs', () => {
  test('clear button removes all logs from the browser', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'message 1');
      await context.injectLog('app', 'message 2');
      await context.injectLog('app', 'message 3');

      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for logs to appear
      await expect(page.locator('.line')).toHaveCount(3);

      // Click the clear button
      await page.click('#clear-btn');

      // Wait for logs to be cleared
      await expect(page.locator('.line')).toHaveCount(0);
    });
  });

  test('new logs appear after clearing', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'old message');

      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for initial log
      await expect(page.locator('.line')).toHaveCount(1);

      // Click the clear button
      await page.click('#clear-btn');

      // Wait for logs to be cleared
      await expect(page.locator('.line')).toHaveCount(0);

      // Inject new log
      await context.injectLog('app', 'new message');

      // Wait for new log to appear
      await expect(page.locator('.line')).toHaveCount(1);
      await expect(page.locator('.line').first()).toContainText('new message');
    });
  });

  test('clear button also clears server buffer', async ({ page, request }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'server message 1');
      await context.injectLog('app', 'server message 2');

      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for logs to appear
      await expect(page.locator('.line')).toHaveCount(2);

      // Verify server has logs via search endpoint
      const beforeClear = await request.get(`${context.url}/search`);
      const beforeData = await beforeClear.json();
      expect(beforeData.length).toBe(2);

      // Click the clear button
      await page.click('#clear-btn');

      // Wait for browser logs to be cleared
      await expect(page.locator('.line')).toHaveCount(0);

      // Verify server buffer is also cleared
      const afterClear = await request.get(`${context.url}/search`);
      const afterData = await afterClear.json();
      expect(afterData.length).toBe(0);
    });
  });

  test('clear removes pinned logs as well', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'message to pin');
      await context.injectLog('app', 'regular message');

      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for logs to appear
      await expect(page.locator('.line')).toHaveCount(2);

      // Pin the first log
      await page.locator('.line').first().hover();
      await page.locator('.line').first().locator('.pin-btn').click();

      // Verify it's pinned
      await expect(page.locator('.line.pinned')).toHaveCount(1);

      // Click the clear button
      await page.click('#clear-btn');

      // Both logs should be cleared, including pinned
      await expect(page.locator('.line')).toHaveCount(0);
      await expect(page.locator('.line.pinned')).toHaveCount(0);
    });
  });

  test('clear works with multiple connected browsers', async ({
    page,
    browser,
  }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'shared message');

      // Open two browser windows
      await page.goto(context.url, { waitUntil: 'commit' });
      const page2 = await browser.newPage();
      await page2.goto(context.url, { waitUntil: 'commit' });

      // Wait for logs in both windows
      await expect(page.locator('.line')).toHaveCount(1);
      await expect(page2.locator('.line')).toHaveCount(1);

      // Click clear in first window
      await page.click('#clear-btn');

      // Both windows should be cleared
      await expect(page.locator('.line')).toHaveCount(0);
      await expect(page2.locator('.line')).toHaveCount(0);

      await page2.close();
    });
  });
});
