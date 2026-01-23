import { runWithTeemux } from '../src/testing/runWithTeemux.js';
import { expect, test } from '@playwright/test';

test.describe('long lines', () => {
  test('very long single line stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // Create a very long line (5000 characters)
      const longMessage = 'x'.repeat(5_000);
      await context.injectLog('app', longMessage);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // The line should contain the full message
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain(longMessage);
    });
  });

  test('long line with spaces stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // Create a long line with words
      const words = Array.from(
        { length: 500 },
        (_, index) => `word${index}`,
      ).join(' ');
      await context.injectLog('app', words);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // Should contain first and last words
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('word0');
      expect(lineContent).toContain('word499');
    });
  });

  test('simple JSON object stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const json = JSON.stringify({ bool: true, key: 'value', number: 123 });
      await context.injectLog('app', json);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // Should contain the JSON content
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('"key"');
      expect(lineContent).toContain('"value"');
    });
  });

  test('large JSON object stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // Create a large JSON object
      const largeObject: Record<string, string> = {};
      for (let index = 0; index < 100; index++) {
        largeObject[`key${index}`] = `value${index}`;
      }

      const json = JSON.stringify(largeObject);
      await context.injectLog('app', json);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // Should contain first and last keys
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('"key0"');
      expect(lineContent).toContain('"key99"');
    });
  });

  test('nested JSON object stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const nested = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, 3, 4, 5],
              deep: 'value',
            },
          },
        },
        metadata: {
          tags: ['tag1', 'tag2', 'tag3'],
          timestamp: '2024-01-01T00:00:00Z',
        },
      };
      const json = JSON.stringify(nested);
      await context.injectLog('app', json);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // Should contain nested content
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('"deep"');
      expect(lineContent).toContain('"value"');
    });
  });

  test('JSON array stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const array = Array.from({ length: 50 }, (_, index) => ({
        id: index,
        name: `item${index}`,
      }));
      const json = JSON.stringify(array);
      await context.injectLog('app', json);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);
    });
  });

  test('multiple long lines each stay as separate entries', async ({
    page,
  }) => {
    await runWithTeemux({}, async (context) => {
      const line1 = 'first-' + 'a'.repeat(1_000);
      const line2 = 'second-' + 'b'.repeat(1_000);
      const line3 = 'third-' + 'c'.repeat(1_000);

      await context.injectLog('app', line1);
      await context.injectLog('app', line2);
      await context.injectLog('app', line3);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly three lines
      await expect(page.locator('.line')).toHaveCount(3);

      // Each line should have its distinct content
      const lines = await page.locator('.line').allTextContents();
      expect(lines[0]).toContain('first-');
      expect(lines[1]).toContain('second-');
      expect(lines[2]).toContain('third-');
    });
  });

  test('line with special characters stays as one entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const special = `Special chars: <>&"' \t tabs and unicode: 日本語 emoji: 🎉`;
      await context.injectLog('app', special);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // Should contain the special content (HTML escaped)
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('Special chars:');
      expect(lineContent).toContain('日本語');
    });
  });

  test('JSON with URLs stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const json = JSON.stringify({
        callback: 'http://localhost:3000/callback',
        url: 'https://example.com/path?query=value&other=123',
      });
      await context.injectLog('app', json);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);
    });
  });

  test('pretty-printed JSON with newlines stays as one log entry', async ({
    page,
  }) => {
    await runWithTeemux({}, async (context) => {
      // Pretty-printed JSON contains actual newline characters
      const prettyJson = JSON.stringify({ key: 'value', num: 42 }, null, 2);
      await context.injectLog('app', prettyJson);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line (newlines within the message should not split it)
      await expect(page.locator('.line')).toHaveCount(1);

      // Should contain both key and num
      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('"key"');
      expect(lineContent).toContain('"num"');
    });
  });

  test('multiline string stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // A string with embedded newlines
      const multiline = 'Line 1\nLine 2\nLine 3';
      await context.injectLog('app', multiline);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      // Content might have newlines converted to <br> but should still be one entry
      const lineElement = page.locator('.line').first();
      await expect(lineElement).toBeVisible();
    });
  });

  test('log message with escaped newlines stays as one entry', async ({
    page,
  }) => {
    await runWithTeemux({}, async (context) => {
      // Literal \n characters (escaped, not actual newlines)
      const escaped = 'Message with \\n escaped \\n newlines';
      await context.injectLog('app', escaped);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('escaped');
    });
  });

  test('JSON error stack trace format stays as one entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // Simulated error with stack trace (common JSON log format)
      const errorLog = JSON.stringify({
        level: 'error',
        message: 'Something went wrong',
        stack:
          'Error: Something went wrong\n    at foo (/app/src/index.js:10:5)\n    at bar (/app/src/index.js:20:3)',
      });
      await context.injectLog('app', errorLog);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);
    });
  });

  test('HTML content stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const htmlContent = `<div class="container"><span id="test">Hello</span><a href="https://example.com">Link</a></div>`;
      await context.injectLog('app', htmlContent);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('container');
    });
  });

  test('CSS content stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      const cssContent = `.container { margin: 0; padding: 10px; } .button { background-color: #007bff; border: none; }`;
      await context.injectLog('app', cssContent);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('container');
      expect(lineContent).toContain('margin');
    });
  });

  test('very long minified CSS stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // Generate a long minified CSS string
      const rules = Array.from(
        { length: 100 },
        (_, index) =>
          `.class${index}{margin:${index}px;padding:${index}px;background:#${String(index).padStart(3, '0')}}`,
      ).join('');
      await context.injectLog('app', rules);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('class0');
      expect(lineContent).toContain('class99');
    });
  });

  test('content with U+2028 Line Separator stays as one log entry', async ({
    page,
  }) => {
    await runWithTeemux({}, async (context) => {
      // U+2028 is a valid JS line terminator that can break string literals
      const contentWithLineSeparator = `before\u2028after`;
      await context.injectLog('app', contentWithLineSeparator);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('before');
      expect(lineContent).toContain('after');
    });
  });

  test('content with U+2029 Paragraph Separator stays as one log entry', async ({
    page,
  }) => {
    await runWithTeemux({}, async (context) => {
      // U+2029 is a valid JS line terminator that can break string literals
      const contentWithParagraphSeparator = `start\u2029end`;
      await context.injectLog('app', contentWithParagraphSeparator);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('start');
      expect(lineContent).toContain('end');
    });
  });

  test('content with null bytes stays as one log entry', async ({ page }) => {
    await runWithTeemux({}, async (context) => {
      // Null bytes could interfere with string handling
      const contentWithNullBytes = `text\u0000with\u0000nulls`;
      await context.injectLog('app', contentWithNullBytes);

      await page.goto(context.url, { waitUntil: 'commit' });

      // Should be exactly one line
      await expect(page.locator('.line')).toHaveCount(1);

      const lineContent = await page.locator('.line').first().textContent();
      expect(lineContent).toContain('text');
      expect(lineContent).toContain('nulls');
    });
  });
});
