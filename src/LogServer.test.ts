import { runWithTeemux } from './testing/runWithTeemux.js';
import http from 'node:http';
import { describe, expect, it } from 'vitest';

const fetchJson = (port: number, path: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        method: 'GET',
        path,
        port,
      },
      (response) => {
        let data = '';
        response.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Failed to parse JSON: ${data}`));
          }
        });
      },
    );

    request.on('error', reject);
    request.end();
  });
};

describe('LogServer', () => {
  describe('clearLogs', () => {
    it('clears the server buffer', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        // Inject some logs
        await context.injectLog('app', 'message 1');
        await context.injectLog('app', 'message 2');
        await context.injectLog('app', 'message 3');

        // Verify logs exist via search
        const beforeClear = (await fetchJson(
          context.port,
          '/search',
        )) as Array<{
          raw: string;
        }>;
        expect(beforeClear.length).toBe(3);
        expect(beforeClear.map((entry) => entry.raw)).toContain(
          '[app] message 1',
        );
        expect(beforeClear.map((entry) => entry.raw)).toContain(
          '[app] message 2',
        );
        expect(beforeClear.map((entry) => entry.raw)).toContain(
          '[app] message 3',
        );

        // Clear logs
        await context.clearLogs();

        // Verify buffer is empty
        const afterClear = (await fetchJson(context.port, '/search')) as Array<{
          raw: string;
        }>;
        expect(afterClear.length).toBe(0);
      });
    });

    it('allows new logs after clearing', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        // Inject initial logs
        await context.injectLog('app', 'old message');

        // Clear logs
        await context.clearLogs();

        // Inject new logs
        await context.injectLog('app', 'new message');

        // Verify only new log exists
        const results = (await fetchJson(context.port, '/search')) as Array<{
          raw: string;
        }>;
        expect(results.length).toBe(1);
        expect(results[0].raw).toBe('[app] new message');
      });
    });

    it('clears events as well as regular logs', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        // Inject logs and events
        await context.injectLog('app', 'message');
        await context.injectEvent('app', 'start', 1_234);
        await context.injectEvent('app', 'exit');

        // Verify they exist
        const beforeClear = (await fetchJson(
          context.port,
          '/search',
        )) as Array<{
          raw: string;
        }>;
        expect(beforeClear.length).toBe(3);

        // Clear logs
        await context.clearLogs();

        // Verify all cleared
        const afterClear = (await fetchJson(context.port, '/search')) as Array<{
          raw: string;
        }>;
        expect(afterClear.length).toBe(0);
      });
    });

    it('works with filtered search after clearing', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        // Inject logs from multiple processes
        await context.injectLog('api', 'api message 1');
        await context.injectLog('worker', 'worker message 1');

        // Clear logs
        await context.clearLogs();

        // Inject new logs
        await context.injectLog('api', 'api message 2');
        await context.injectLog('worker', 'worker message 2');

        // Search with filter - should only find new logs
        const results = (await fetchJson(
          context.port,
          '/search?include=api',
        )) as Array<{
          raw: string;
        }>;
        expect(results.length).toBe(1);
        expect(results[0].raw).toBe('[api] api message 2');
      });
    });
  });
});
