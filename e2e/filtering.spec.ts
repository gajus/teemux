import { runWithTeemux } from '../src/testing/runWithTeemux.js';
import { expect, test } from '@playwright/test';

test.describe('filtering', () => {
  test('shows all logs when no filter is applied', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'INFO: application started');
      await context.injectLog('app', 'ERROR: something failed');
      await context.injectLog('app', 'DEBUG: some debug info');

      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for logs to appear
      await expect(page.locator('.line')).toHaveCount(3);
    });
  });

  test('filters logs by include parameter in URL', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'INFO: application started');
      await context.injectLog('app', 'ERROR: something failed');
      await context.injectLog('app', 'DEBUG: some debug info');

      await page.goto(`${context.url}?include=ERROR`, { waitUntil: 'commit' });

      // Wait for all logs to be received (3 total, but only 1 visible)
      await expect(page.locator('.line')).toHaveCount(3);

      // Only ERROR line should be visible
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(1);
      await expect(visibleLines.first()).toContainText('ERROR');
    });
  });

  test('filters with multiple include terms (OR logic)', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'INFO: user logged in');
      await context.injectLog('app', 'ERROR: system error');
      await context.injectLog('app', 'DEBUG: something else');

      await page.goto(`${context.url}?include=INFO,ERROR`, {
        waitUntil: 'commit',
      });

      // Wait for all logs to be received
      await expect(page.locator('.line')).toHaveCount(3);

      // Lines with INFO OR ERROR should be visible (not DEBUG)
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(2);
    });
  });

  test('excludes logs by exclude parameter', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'INFO: application started');
      await context.injectLog('app', 'ERROR: something failed');
      await context.injectLog('app', 'DEBUG: verbose output');

      await page.goto(`${context.url}?exclude=DEBUG`, { waitUntil: 'commit' });

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
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'INFO: application started');
      await context.injectLog('app', 'ERROR: something failed');

      await page.goto(context.url, { waitUntil: 'commit' });

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
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'ERROR: something failed');
      await context.injectLog('app', 'error: lowercase error');

      await page.goto(`${context.url}?include=error`, { waitUntil: 'commit' });

      // Wait for all logs to be received
      await expect(page.locator('.line')).toHaveCount(2);

      // Both lines should match (case insensitive)
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(2);
    });
  });

  test('server-side search finds logs beyond browser buffer', async ({
    page,
  }) => {
    await runWithTeemux({ buffer: 2000 }, async (context) => {
      // Inject early logs with a unique marker
      for (let i = 0; i < 10; i++) {
        await context.injectLog('app', `EARLY_MARKER log number ${i}`);
      }

      // Inject 1000 filler logs to push early logs out of browser's initial load
      // (browser only receives last 1000 logs on connect)
      for (let i = 0; i < 1000; i++) {
        await context.injectLog('app', `FILLER log number ${i}`);
      }

      // Navigate to page - browser receives last 1000 logs (all FILLER)
      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for initial logs to load
      await expect(page.locator('.line')).toHaveCount(1000);

      // Verify no EARLY_MARKER logs are visible initially
      await expect(page.locator('.line:visible')).toHaveCount(1000);
      const earlyLogsInitially = page.locator(
        '.line:visible:has-text("EARLY_MARKER")',
      );
      await expect(earlyLogsInitially).toHaveCount(0);

      // Type in the filter to trigger server-side search
      await page.fill('#include', 'EARLY_MARKER');

      // Wait for server-side search to complete (debounce is 300ms)
      await page.waitForTimeout(500);

      // Now the 10 early logs should be visible (fetched from server)
      const visibleLines = page.locator('.line:visible');
      await expect(visibleLines).toHaveCount(10);

      // All visible lines should contain EARLY_MARKER
      for (const line of await visibleLines.all()) {
        await expect(line).toContainText('EARLY_MARKER');
      }
    });
  });
});
