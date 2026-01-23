import { runWithTeemux } from '../src/testing/runWithTeemux.js';
import { expect, test } from '@playwright/test';

test.describe('summary capsules', () => {
  test('displays summary capsules for JSON logs with URL parameter', async ({
    page,
  }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog(
        'app',
        '{"level":"error","message":"something failed"}',
      );

      await page.goto(`${context.url}?summary=level,message`, {
        waitUntil: 'commit',
      });

      // Wait for log to appear
      await expect(page.locator('.line')).toHaveCount(1);

      // Check capsules are rendered
      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(2);

      // Verify capsule content
      await expect(capsules.first()).toContainText('level:');
      await expect(capsules.first()).toContainText('error');
      await expect(capsules.nth(1)).toContainText('message:');
      await expect(capsules.nth(1)).toContainText('something failed');
    });
  });

  test('displays capsules for nested JSON paths', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog(
        'app',
        '{"error":{"code":404,"message":"not found"}}',
      );

      await page.goto(`${context.url}?summary=error.code,error.message`, {
        waitUntil: 'commit',
      });

      await expect(page.locator('.line')).toHaveCount(1);

      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(2);

      await expect(capsules.first()).toContainText('code:');
      await expect(capsules.first()).toContainText('404');
      await expect(capsules.nth(1)).toContainText('message:');
      await expect(capsules.nth(1)).toContainText('not found');
    });
  });

  test('skips missing fields silently', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', '{"level":"info"}');

      await page.goto(`${context.url}?summary=level,missing`, {
        waitUntil: 'commit',
      });

      await expect(page.locator('.line')).toHaveCount(1);

      // Only one capsule for the field that exists
      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(1);
      await expect(capsules.first()).toContainText('level:');
      await expect(capsules.first()).toContainText('info');
    });
  });

  test('shows no capsules for non-JSON logs', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', 'plain text log message');

      await page.goto(`${context.url}?summary=level`, { waitUntil: 'commit' });

      await expect(page.locator('.line')).toHaveCount(1);

      // No capsules for non-JSON log
      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(0);
    });
  });

  test('handles JSON logs with app prefix', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // The log will be formatted as [app] {"level":"warn"} by teemux
      await context.injectLog(
        'app',
        '{"level":"warn","msg":"warning message"}',
      );

      await page.goto(`${context.url}?summary=level`, { waitUntil: 'commit' });

      await expect(page.locator('.line')).toHaveCount(1);

      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(1);
      await expect(capsules.first()).toContainText('level:');
      await expect(capsules.first()).toContainText('warn');
    });
  });

  test('updates capsules when typing in summary input', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog(
        'app',
        '{"level":"debug","message":"test message"}',
      );

      await page.goto(context.url, { waitUntil: 'commit' });

      // Wait for log to appear
      await expect(page.locator('.line')).toHaveCount(1);

      // Initially no capsules
      await expect(page.locator('.summary-capsule')).toHaveCount(0);

      // Type in the summary input
      await page.fill('#summary', 'level');

      // Wait for debounce
      await page.waitForTimeout(200);

      // Now capsule should appear
      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(1);
      await expect(capsules.first()).toContainText('level:');
      await expect(capsules.first()).toContainText('debug');
    });
  });

  test('persists summary parameter in URL', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', '{"level":"error"}');

      await page.goto(context.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Type in the summary input
      await page.fill('#summary', 'level');

      // Wait for debounce and URL update
      await page.waitForTimeout(200);

      // Check URL contains summary parameter
      const url = new URL(page.url());
      expect(url.searchParams.get('summary')).toBe('level');
    });
  });

  test('truncates long values with ellipsis', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const longValue =
        'this is a very long message that exceeds fifty characters and should be truncated';
      await context.injectLog('app', JSON.stringify({ message: longValue }));

      await page.goto(`${context.url}?summary=message`, {
        waitUntil: 'commit',
      });

      await expect(page.locator('.line')).toHaveCount(1);

      const capsule = page.locator('.summary-capsule');
      await expect(capsule).toHaveCount(1);

      // Value should be truncated with ellipsis
      const valueText = await capsule
        .locator('.summary-capsule-value')
        .textContent();
      expect(valueText?.length).toBeLessThanOrEqual(50);
      expect(valueText).toContain('...');
    });
  });

  test('displays object values as JSON', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', '{"data":{"nested":"value","count":42}}');

      await page.goto(`${context.url}?summary=data`, { waitUntil: 'commit' });

      await expect(page.locator('.line')).toHaveCount(1);

      const capsule = page.locator('.summary-capsule');
      await expect(capsule).toHaveCount(1);
      await expect(capsule).toContainText('data:');
      await expect(capsule).toContainText('nested');
    });
  });

  test('escapes HTML in values to prevent XSS', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', '{"message":"<script>alert(1)</script>"}');

      await page.goto(`${context.url}?summary=message`, {
        waitUntil: 'commit',
      });

      await expect(page.locator('.line')).toHaveCount(1);

      // Script tag should be escaped, not executed
      const capsule = page.locator('.summary-capsule');
      await expect(capsule).toHaveCount(1);

      // Check that it displays the text, not executes it
      const valueText = await capsule
        .locator('.summary-capsule-value')
        .textContent();
      expect(valueText).toContain('<script>');
    });
  });

  test('works with multiple JSON logs', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      await context.injectLog('app', '{"level":"info","msg":"first"}');
      await context.injectLog('app', '{"level":"error","msg":"second"}');
      await context.injectLog('app', '{"level":"warn","msg":"third"}');

      await page.goto(`${context.url}?summary=level`, { waitUntil: 'commit' });

      await expect(page.locator('.line')).toHaveCount(3);

      // Each JSON line should have a capsule
      const capsules = page.locator('.summary-capsule');
      await expect(capsules).toHaveCount(3);
    });
  });
});
