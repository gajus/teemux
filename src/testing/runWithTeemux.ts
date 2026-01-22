import { LogServer } from '../LogServer.js';
import http from 'node:http';

export type TeemuxContext = {
  /**
   * Clear all logs from the server buffer and notify connected clients.
   */
  clearLogs: () => Promise<void>;
  /**
   * Inject an event (start/exit) for a named process.
   */
  injectEvent: (
    name: string,
    event: 'exit' | 'start',
    pid?: number,
  ) => Promise<void>;
  /**
   * Inject a log message for a named process.
   */
  injectLog: (name: string, message: string) => Promise<void>;
  /**
   * The port the server is running on.
   */
  port: number;
  /**
   * The full URL to the teemux server.
   */
  url: string;
};

export type TeemuxOptions = {
  /**
   * Number of log lines to keep in the server buffer.
   */
  buffer?: number;
  /**
   * Port to run on. If 0 or undefined, auto-assigns an available port.
   */
  port?: number;
};

const postJson = (
  port: number,
  path: string,
  data?: Record<string, unknown>,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers: Record<string, number | string> = {};

    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    } else {
      headers['Content-Length'] = 0;
    }

    const request = http.request(
      {
        headers,
        hostname: '127.0.0.1',
        method: 'POST',
        path,
        port,
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve());
      },
    );

    request.on('error', reject);
    if (postData) {
      request.write(postData);
    }

    request.end();
  });
};

/**
 * Run a test with a teemux server.
 *
 * Starts a LogServer, provides a context for injecting logs,
 * and ensures cleanup after the callback completes.
 * @example
 * ```typescript
 * await runWithTeemux({ port: 9950 }, async (ctx) => {
 *   await ctx.injectLog('app', 'Hello world');
 *   await page.goto(ctx.url);
 *   // ... assertions
 * });
 * ```
 */
export const runWithTeemux = async (
  options: TeemuxOptions,
  callback: (context: TeemuxContext) => Promise<void>,
): Promise<void> => {
  const server = new LogServer(options.port ?? 0, options.buffer ?? 10_000);

  await server.start();

  const port = server.getPort();
  const url = `http://127.0.0.1:${port}`;

  const context: TeemuxContext = {
    clearLogs: async () => {
      await postJson(port, '/clear');
    },
    injectEvent: async (
      name: string,
      event: 'exit' | 'start',
      pid?: number,
    ) => {
      await postJson(port, '/inject', { event, name, pid });
    },
    injectLog: async (name: string, message: string) => {
      await postJson(port, '/inject', { message, name });
    },
    port,
    url,
  };

  try {
    await callback(context);
  } finally {
    await server.stop();
  }
};
