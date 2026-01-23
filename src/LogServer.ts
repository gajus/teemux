import { McpHandler } from './McpHandler.js';
import { highlightJson } from './utils/highlightJson.js';
import { linkifyUrls } from './utils/linkifyUrls.js';
import { matchesFilters } from './utils/matchesFilters.js';
import { stripAnsi } from './utils/stripAnsi.js';
import Convert from 'ansi-to-html';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';

// Read the client bundle at module load time
// Check multiple paths to handle both production (dist/) and test (src/) scenarios
let clientBundle: string;
const bundlePaths = [
  join(import.meta.dirname, 'client/client.js'), // dist/client/client.js when running from dist/
  join(import.meta.dirname, '../dist/client/client.js'), // dist/client/client.js when running from src/
];

clientBundle = '// Client bundle not found - run npm run build:client';
for (const bundlePath of bundlePaths) {
  try {
    clientBundle = readFileSync(bundlePath, 'utf8');
    break;
  } catch {
    // Try next path
  }
}

const COLORS = [
  '\u001B[36m',
  '\u001B[33m',
  '\u001B[32m',
  '\u001B[35m',
  '\u001B[34m',
  '\u001B[91m',
  '\u001B[92m',
  '\u001B[93m',
];
const RESET = '\u001B[0m';
const DIM = '\u001B[90m';
const RED = '\u001B[91m';
const HOST = '0.0.0.0';

type BufferedLog = {
  line: string;
  timestamp: number;
};

type EventPayload = {
  code?: number;
  event: 'exit' | 'start';
  name: string;
  pid: number;
  timestamp: number;
};

type LogPayload = {
  line: string;
  name: string;
  timestamp: number;
  type: LogType;
};

type LogType = 'stderr' | 'stdout';

type StreamClient = {
  excludes: string[];
  includes: string[];
  isBrowser: boolean;
  response: http.ServerResponse;
};

export class LogServer {
  private ansiConverter = new Convert({ escapeXML: true, newline: true });

  private buffer: BufferedLog[] = [];

  private clients = new Set<StreamClient>();

  private colorIndex = 0;

  private colorMap = new Map<string, string>();

  private mcpHandler: McpHandler;

  private port: number;

  private server: http.Server | null = null;

  private tailSize: number;

  constructor(port: number, tailSize: number = 10_000) {
    this.port = port;
    this.tailSize = tailSize;
    this.mcpHandler = new McpHandler({
      clearLogs: () => this.clearLogs(),
      getBuffer: () => this.buffer,
    });
  }

  clearLogs(): void {
    // Clear the server buffer
    this.buffer = [];

    // Notify all browser clients to clear their logs
    for (const client of this.clients) {
      if (client.isBrowser) {
        client.response.write(`<script>clearLogs()</script>\n`);
      }
    }
  }

  getPort(): number {
    if (this.server) {
      const address = this.server.address();
      if (address && typeof address === 'object') {
        return address.port;
      }
    }

    return this.port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((request, response) => {
        // Handle search endpoint - returns matching logs as JSON
        if (request.method === 'GET' && request.url?.startsWith('/search')) {
          const url = new URL(request.url, `http://${request.headers.host}`);
          const includeParameter = url.searchParams.get('include');
          const includes = includeParameter
            ? includeParameter
                .split(',')
                .map((term) => term.trim())
                .filter(Boolean)
            : [];
          const excludeParameter = url.searchParams.get('exclude');
          const excludes = excludeParameter
            ? excludeParameter
                .split(',')
                .map((pattern) => pattern.trim())
                .filter(Boolean)
            : [];
          const limit = Math.min(
            Number.parseInt(url.searchParams.get('limit') ?? '1000', 10),
            1_000,
          );

          // Sort buffer by timestamp
          const sortedBuffer = this.buffer.toSorted(
            (a, b) => a.timestamp - b.timestamp,
          );

          // Filter and limit results
          const results: Array<{ html: string; raw: string }> = [];

          for (const entry of sortedBuffer) {
            if (matchesFilters(entry.line, includes, excludes)) {
              let html = this.ansiConverter.toHtml(entry.line);
              html = highlightJson(html);
              html = linkifyUrls(html);
              results.push({
                html,
                raw: stripAnsi(entry.line),
              });

              if (results.length >= limit) {
                break;
              }
            }
          }

          response.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json; charset=utf-8',
          });
          response.end(JSON.stringify(results));
          return;
        }

        // Handle MCP endpoint (GET for SSE stream)
        if (request.method === 'GET' && request.url?.startsWith('/mcp')) {
          void this.mcpHandler.handleRequest(request, response, '');
          return;
        }

        // Handle streaming GET request
        if (request.method === 'GET' && request.url?.startsWith('/')) {
          const url = new URL(request.url, `http://${request.headers.host}`);
          const includeParameter = url.searchParams.get('include');
          const includes = includeParameter
            ? includeParameter
                .split(',')
                .map((term) => term.trim())
                .filter(Boolean)
            : [];
          const excludeParameter = url.searchParams.get('exclude');
          const excludes = excludeParameter
            ? excludeParameter
                .split(',')
                .map((pattern) => pattern.trim())
                .filter(Boolean)
            : [];

          const userAgent = request.headers['user-agent'] ?? '';
          const isBrowser = userAgent.includes('Mozilla');

          // Sort buffer by timestamp
          const sortedBuffer = this.buffer.toSorted(
            (a, b) => a.timestamp - b.timestamp,
          );

          if (isBrowser) {
            // Browser: send initial batch (limited), more available via /search
            response.writeHead(200, {
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'Content-Type': 'text/html; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            });

            // Send HTML header with styling
            response.write(this.getHtmlHeader());

            // Send last 1000 logs initially (browser can fetch more via /search)
            const initialLogs = sortedBuffer.slice(-1_000);

            for (const entry of initialLogs) {
              response.write(this.getHtmlLine(entry.line));
            }
          } else {
            // Non-browser (curl, etc): apply server-side filtering
            const filteredBuffer = sortedBuffer.filter((entry) =>
              matchesFilters(entry.line, includes, excludes),
            );

            response.writeHead(200, {
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            });

            // Send filtered logs as plain text (strip ANSI)
            for (const entry of filteredBuffer) {
              response.write(stripAnsi(entry.line) + '\n');
            }
          }

          // Add to clients for streaming
          const client: StreamClient = {
            excludes,
            includes,
            isBrowser,
            response,
          };

          this.clients.add(client);

          request.on('close', () => {
            this.clients.delete(client);
          });

          return;
        }

        let body = '';

        request.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        request.on('end', () => {
          if (request.method === 'POST' && request.url === '/log') {
            try {
              const { line, name, timestamp, type } = JSON.parse(
                body,
              ) as LogPayload;

              this.broadcastLog(name, line, type, timestamp);
            } catch {
              // Ignore parse errors
            }

            response.writeHead(200);
            response.end();
          } else if (request.method === 'POST' && request.url === '/event') {
            try {
              const { code, event, name, pid, timestamp } = JSON.parse(
                body,
              ) as EventPayload;

              if (event === 'start') {
                this.broadcastEvent(name, `● started (pid ${pid})`, timestamp);
              } else if (event === 'exit') {
                this.broadcastEvent(name, `○ exited (code ${code})`, timestamp);
              }
            } catch {
              // Ignore parse errors
            }

            response.writeHead(200);
            response.end();
          } else if (request.method === 'POST' && request.url === '/inject') {
            // Test injection endpoint
            try {
              const data = JSON.parse(body) as {
                event?: 'exit' | 'start';
                message: string;
                name: string;
                pid?: number;
              };
              const timestamp = performance.timeOrigin + performance.now();

              if (data.event === 'start') {
                this.broadcastEvent(
                  data.name,
                  `● started (pid ${data.pid ?? 0})`,
                  timestamp,
                );
              } else if (data.event === 'exit') {
                this.broadcastEvent(data.name, `○ exited (code 0)`, timestamp);
              } else {
                this.broadcastLog(data.name, data.message, 'stdout', timestamp);
              }
            } catch {
              // Ignore parse errors
            }

            response.writeHead(200);
            response.end();
          } else if (request.method === 'POST' && request.url === '/clear') {
            // Clear all logs from buffer and notify clients
            this.clearLogs();

            response.writeHead(200);
            response.end();
          } else if (request.method === 'POST' && request.url === '/shutdown') {
            // Gracefully shutdown the server (used by force-leader)
            response.writeHead(200);
            response.end();

            // Stop the server after responding
            void this.stop();
          } else if (
            (request.method === 'POST' || request.method === 'DELETE') &&
            request.url?.startsWith('/mcp')
          ) {
            // Handle MCP POST and DELETE requests
            void this.mcpHandler.handleRequest(request, response, body);
          } else {
            response.writeHead(200);
            response.end();
          }
        });
      });

      this.server.once('error', (error: NodeJS.ErrnoException) => {
        reject(error);
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        // eslint-disable-next-line no-console
        console.log(
          `${DIM}[teemux] aggregating logs on http://${HOST}:${this.port}${RESET}`,
        );
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all client connections
      for (const client of this.clients) {
        client.response.end();
      }

      this.clients.clear();

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private broadcastEvent(
    name: string,
    message: string,
    timestamp: number,
  ): void {
    const color = this.getColor(name);
    const forWeb = `${DIM}${color}[${name}]${RESET} ${DIM}${message}${RESET}`;

    this.sendToClients(forWeb, timestamp);
  }

  private broadcastLog(
    name: string,
    line: string,
    type: LogType,
    timestamp: number,
  ): void {
    const color = this.getColor(name);
    const errorPrefix = type === 'stderr' ? `${RED}[ERR]${RESET} ` : '';
    const forWeb = `${color}[${name}]${RESET} ${errorPrefix}${line}`;

    this.sendToClients(forWeb, timestamp);
  }

  private getColor(name: string): string {
    if (!this.colorMap.has(name)) {
      this.colorMap.set(name, COLORS[this.colorIndex++ % COLORS.length]);
    }

    return this.colorMap.get(name) ?? COLORS[0];
  }

  private getHtmlHeader(): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>teemux</title>
</head>
<body>
  <div id="root"></div>
  <script>const tailSize = Math.min(${this.tailSize}, 1000);</script>
  <script>${clientBundle}</script>
`;
  }

  private getHtmlLine(line: string): string {
    let html = this.ansiConverter.toHtml(line);
    html = highlightJson(html);
    html = linkifyUrls(html);
    const raw = stripAnsi(line);
    // Escape </ to prevent closing script tag in HTML parser
    const safeHtml = JSON.stringify(html).replaceAll('</', '<\\/');
    const safeRaw = JSON.stringify(raw).replaceAll('</', '<\\/');
    return `<script>addLine(${safeHtml}, ${safeRaw})</script>\n`;
  }

  private sendToClients(forWeb: string, timestamp: number): void {
    // Add to buffer
    this.buffer.push({ line: forWeb, timestamp });

    // Trim buffer to tail size
    if (this.buffer.length > this.tailSize) {
      this.buffer.shift();
    }

    // Send to all connected clients
    for (const client of this.clients) {
      if (client.isBrowser) {
        client.response.write(this.getHtmlLine(forWeb));
      } else {
        // Server-side filtering for non-browser clients
        if (!matchesFilters(forWeb, client.includes, client.excludes)) {
          continue;
        }

        client.response.write(stripAnsi(forWeb) + '\n');
      }
    }

    // Note: Each client prints its own logs locally, so server doesn't need to
  }
}
