# Agent Development Guidelines

Best practices for AI agents working on this codebase, derived from real development sessions.

## Code Style Preferences

### Imports

- **No barrel files** - Import functions directly from the files that contain them, not from `index.ts` re-exports
- Example: `import { highlightJson } from './utils/highlightJson.js'` ✓
- Avoid: `import { highlightJson } from './utils'` ✗

### File Naming

- **File names match main export** - If a file exports `highlightJson`, the file should be named `highlightJson.ts`
- Example: `linkifyUrls.ts` exports `linkifyUrls` ✓
- Avoid: `linkify.ts` exports `linkifyUrls` ✗

### Single Main Export

- **One main export per file** - Each file should have a single primary export
- Secondary exports (like supporting types) are fine
- Avoid files that export multiple unrelated functions (acts like a barrel file)
- Example: `unescapeHtml.ts` and `stripHtmlTags.ts` as separate files ✓
- Avoid: `html.ts` exporting both `unescapeHtml` and `stripHtmlTags` ✗

### Tests

- **Co-locate tests with source files** - If you have `linkifyUrls.ts`, the test should be `linkifyUrls.test.ts` in the same directory
- Do not use `__tests__` directories

## Testing Strategies

### 1. End-to-End CLI Testing

**What works best:** Combine build + run + verify in a single command chain.

```bash
# Build, run server in background, wait for startup, then test
pnpm build && ./dist/teemux.js -p 9900 -- bash -c 'echo "test" && sleep 30' &
sleep 2
curl -s --max-time 3 http://127.0.0.1:9900/
```

**Key techniques:**

- Use `&` to background the server process
- Use `sleep` to wait for server startup (2s is usually sufficient)
- Use `--max-time` with curl to avoid hanging on streaming endpoints
- Use non-default port to avoid conflicts (e.g. 9900)

### 2. Testing Browser vs CLI Output

The server detects browsers via User-Agent. Test both modes:

```bash
# CLI/curl output (plain text)
curl -s --max-time 3 http://127.0.0.1:9900/

# Browser output (HTML)
curl -s --max-time 3 -H "User-Agent: Mozilla/5.0" http://127.0.0.1:9900/
```

### 3. Verifying Specific Output Patterns

Use `grep` to verify expected patterns exist:

```bash
# Check for JSON syntax highlighting classes
curl -s -H "User-Agent: Mozilla/5.0" http://127.0.0.1:9900/ | grep -o "json-[a-z]*" | sort | uniq

# Verify specific HTML structure
curl -s -H "User-Agent: Mozilla/5.0" http://127.0.0.1:9900/ | grep 'class="json-key"'
```

### 4. Testing JSON Output

Generate controlled JSON to test parsing/highlighting:

```bash
./dist/teemux.js -p 9900 -- bash -c 'echo "{\"key\":\"value\",\"num\":42,\"bool\":true}" && sleep 10'
```

## Common Pitfalls

### Timing Issues
- **Problem:** Server not ready when curl runs
- **Solution:** Add `sleep 2` between starting server and testing

### Port Conflicts
- **Problem:** `EADDRINUSE` when rerunning tests
- **Solution:** Use different ports for each test, or wait for previous process to exit

### Streaming Endpoints Hang
- **Problem:** curl waits forever on streaming endpoints
- **Solution:** Use `--max-time 3` to timeout after 3 seconds

### Process Cleanup
- **Problem:** Background processes left running
- **Solution:** Tests with `sleep` will auto-exit; for long-running tests, track PIDs

## Unit Testing

### Running Tests

```bash
pnpm test:vitest
```

### Test Structure

Tests are co-located with source files:

- `src/utils/highlightJson.test.ts` - JSON syntax highlighting (21 tests)
- `src/utils/linkifyUrls.test.ts` - URL linkification (20 tests)
- `src/utils/stripAnsi.test.ts` - ANSI code stripping (14 tests)
- `src/utils/matchesFilters.test.ts` - Filter matching logic (36 tests)
- `src/utils/extractJsonFields.test.ts` - JSON field extraction (20 tests)
- `src/LogServer.test.ts` - Log server functionality (4 tests)
- `src/McpHandler.test.ts` - MCP protocol handler (12 tests)

## Playwright Tests (E2E)

### Running Tests

```bash
pnpm test:playwright
```

### Test Helper

Use the `runWithTeemux` helper to start a teemux server for testing:

```typescript
import { runWithTeemux } from '../src/testing/runWithTeemux.js';

test('example test', async ({ page }) => {
  await runWithTeemux({}, async (ctx) => {
    // Inject logs directly
    await ctx.injectLog('app', 'Hello world');
    await ctx.injectLog('api', '{"status":"ok"}');

    // Inject events
    await ctx.injectEvent('app', 'start', 12345);
    await ctx.injectEvent('app', 'exit');

    // Clear all logs
    await ctx.clearLogs();

    // Navigate to the teemux URL
    await page.goto(ctx.url);

    // Port is auto-assigned when not specified
    console.log(`Server running on port ${ctx.port}`);
  });
  // Server is automatically stopped after callback
});
```

### Test Files

- `e2e/clear.spec.ts` - Log clearing functionality (7 tests)
- `e2e/filtering.spec.ts` - Filter/exclude functionality (7 tests)
- `e2e/highlight.spec.ts` - Highlighting feature (5 tests)
- `e2e/jsonHighlight.spec.ts` - JSON syntax highlighting (8 tests)
- `e2e/links.spec.ts` - URL linkification (6 tests)
- `e2e/longLines.spec.ts` - Long line handling (19 tests)
- `e2e/pinning.spec.ts` - Pin functionality (4 tests)
- `e2e/summary.spec.ts` - Summary view functionality (11 tests)

### Writing New Tests

Pure functions are extracted to `src/utils/` for testability. Place tests alongside the source file:

```typescript
// src/utils/myFunction.test.ts
import { describe, expect, it } from 'vitest';
import { myFunction } from './myFunction.js';

describe('myFunction', () => {
  it('handles basic case', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

### Test Coverage Areas

| Module | What's Tested |
|--------|---------------|
| `highlightJson.ts` | Keys, strings, numbers, booleans, null, nested objects, arrays |
| `linkifyUrls.ts` | http/https/file URLs, trailing punctuation, existing href handling |
| `stripAnsi.ts` | Color codes, bold/dim, 256 colors, nested formatting |
| `matchesFilters.ts` | AND/OR logic, case insensitivity, ANSI handling, edge cases |
| `extractJsonFields.ts` | JSON field extraction from log lines |
| `LogServer.ts` | Server lifecycle, log broadcasting, client connections |
| `McpHandler.ts` | MCP protocol requests, session management, tools/resources |

## Code Quality Checks

### Before Committing

1. **Run unit tests:**
   ```bash
   pnpm test:vitest
   ```

2. **Run E2E tests:**
   ```bash
   pnpm test:playwright
   ```

3. **Build successfully:**
   ```bash
   pnpm build
   ```

4. **No linter errors:**
   ```bash
   pnpm lint
   ```

5. **Verify runtime behavior:**
   ```bash
   ./dist/teemux.js -p 9900 -- echo "test"
   ```

## Debugging Tips

### HTML Output Issues

When HTML rendering doesn't work as expected:

1. Capture raw HTML output:
   ```bash
   curl -s -H "User-Agent: Mozilla/5.0" http://127.0.0.1:9900/ > debug.html
   ```

2. Look for malformed HTML or escaped characters:
   ```bash
   grep -o '<span[^>]*>' debug.html | head -20
   ```

### JSON Parsing Issues

When JSON detection/highlighting fails:

1. Check if HTML entities are being handled:
   - `&quot;` for quotes
   - `&amp;` for ampersands

2. Verify regex patterns handle escaped content

### Client-Side JavaScript Issues

For browser-side features (filtering, pinning):

1. Test in actual browser with DevTools console
2. Check for JavaScript errors in the streamed HTML

## Architecture Notes

### Server Components

- `LogServer`: Aggregates logs, serves HTTP streaming, handles React client
- `McpHandler`: Model Context Protocol handler for AI tool integration
- Both components handle their own output (server broadcasts to connected clients)

### Key Processing Pipeline

1. Raw log → ANSI colors preserved
2. → `ansi-to-html` conversion
3. → JSON syntax highlighting (if pure JSON)
4. → URL linkification
5. → Streamed to React client via SSE
6. → Rendered with filtering/highlighting in browser

### Client-Side Features

Features running in the React client (built with Vite and PandaCSS):
- Filtering (include, exclude)
- Highlighting (highlight matches)
- Summary mode (JSON field extraction)
- Pinning (persist important lines)
- Clear logs (Cmd/Ctrl+K shortcut)
- Buffer trimming
- Auto-scroll (tailing)
