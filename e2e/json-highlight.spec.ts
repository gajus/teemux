import { expect, test } from '@playwright/test';

import { runWithTeemux } from '../src/testing/runWithTeemux.js';

test.describe('JSON highlighting', () => {
  test('highlights JSON keys', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', '{"name":"value"}');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Check for json-key class
      await expect(page.locator('.json-key')).toHaveCount(1);
      await expect(page.locator('.json-key')).toContainText('name');
    });
  });

  test('highlights JSON string values', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', '{"key":"string value"}');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Check for json-string class
      await expect(page.locator('.json-string')).toHaveCount(1);
      await expect(page.locator('.json-string')).toContainText('string value');
    });
  });

  test('highlights JSON numbers', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', '{"count":42}');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Check for json-number class
      await expect(page.locator('.json-number')).toHaveCount(1);
      await expect(page.locator('.json-number')).toContainText('42');
    });
  });

  test('highlights JSON booleans', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', '{"active":true,"disabled":false}');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Check for json-bool class (true and false)
      await expect(page.locator('.json-bool')).toHaveCount(2);
    });
  });

  test('highlights JSON null', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', '{"value":null}');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // null should have json-bool class
      await expect(page.locator('.json-bool')).toContainText('null');
    });
  });

  test('does not highlight non-JSON text', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', 'This is plain text, not JSON');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // No JSON highlighting classes should be present
      await expect(page.locator('.json-key')).toHaveCount(0);
      await expect(page.locator('.json-string')).toHaveCount(0);
      await expect(page.locator('.json-number')).toHaveCount(0);
    });
  });

  test('highlights complex nested JSON', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog(
        'app',
        '{"user":{"name":"John","age":30},"active":true}',
      );

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Should have multiple keys: user, name, age, active
      const keys = page.locator('.json-key');
      await expect(keys).toHaveCount(4);

      // Should have string value
      await expect(page.locator('.json-string')).toContainText('John');

      // Should have number
      await expect(page.locator('.json-number')).toContainText('30');

      // Should have boolean
      await expect(page.locator('.json-bool')).toContainText('true');
    });
  });

  test('highlights JSON arrays', async ({ page }) => {
    await runWithTeemux({}, async (ctx) => {
      await ctx.injectLog('app', '[1, 2, 3]');

      await page.goto(ctx.url, { waitUntil: 'commit' });
      await expect(page.locator('.line')).toHaveCount(1);

      // Should have 3 numbers
      await expect(page.locator('.json-number')).toHaveCount(3);
    });
  });
});
