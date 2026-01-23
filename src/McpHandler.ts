import { stripAnsi } from './utils/stripAnsi.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import type http from 'node:http';
import { z } from 'zod';

type BufferedLog = {
  line: string;
  timestamp: number;
};

type McpHandlerOptions = {
  clearLogs: () => void;
  getBuffer: () => BufferedLog[];
};

export class McpHandler {
  private clearLogs: () => void;

  private getBuffer: () => BufferedLog[];

  private transports: Record<string, StreamableHTTPServerTransport> = {};

  constructor(options: McpHandlerOptions) {
    this.getBuffer = options.getBuffer;
    this.clearLogs = options.clearLogs;
  }

  async handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    body: string,
  ): Promise<void> {
    const method = request.method;
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (method === 'POST') {
      await this.handlePost(request, response, body, sessionId);
    } else if (method === 'GET') {
      await this.handleGet(request, response, sessionId);
    } else if (method === 'DELETE') {
      await this.handleDelete(request, response, sessionId);
    } else {
      response.writeHead(405);
      response.end('Method not allowed');
    }
  }

  private createMcpServer(): McpServer {
    const server = new McpServer({
      name: 'teemux',
      version: '1.0.0',
    });

    server.registerTool(
      'get_logs',
      {
        description: 'Get recent logs from buffer',
        inputSchema: {
          exclude: z
            .string()
            .optional()
            .describe('Comma-separated patterns to exclude'),
          include: z
            .string()
            .optional()
            .describe('Comma-separated patterns to include'),
          limit: z
            .number()
            .optional()
            .default(100)
            .describe('Maximum number of logs to return'),
        },
      },
      async ({ exclude, include, limit }) => {
        const logs = this.filterLogs({ exclude, include, limit });
        return {
          content: [{ text: JSON.stringify(logs, null, 2), type: 'text' }],
        };
      },
    );

    server.registerTool(
      'search_logs',
      {
        description: 'Search logs with patterns',
        inputSchema: {
          exclude: z
            .string()
            .optional()
            .describe('Comma-separated patterns to exclude'),
          include: z
            .string()
            .optional()
            .describe('Comma-separated patterns to include'),
          limit: z
            .number()
            .optional()
            .default(100)
            .describe('Maximum number of logs to return'),
        },
      },
      async ({ exclude, include, limit }) => {
        const logs = this.filterLogs({ exclude, include, limit });
        return {
          content: [{ text: JSON.stringify(logs, null, 2), type: 'text' }],
        };
      },
    );

    server.registerTool(
      'clear_logs',
      {
        description: 'Clear the log buffer',
        inputSchema: {},
      },
      async () => {
        this.clearLogs();
        return {
          content: [{ text: 'Logs cleared successfully', type: 'text' }],
        };
      },
    );

    server.registerTool(
      'get_process_names',
      {
        description: 'List all process names that have logged',
        inputSchema: {},
      },
      async () => {
        const processNames = this.getProcessNames();
        return {
          content: [
            { text: JSON.stringify(processNames, null, 2), type: 'text' },
          ],
        };
      },
    );

    return server;
  }

  private filterLogs(options: {
    exclude?: string;
    include?: string;
    limit?: number;
  }): Array<{ raw: string; timestamp: number }> {
    const buffer = this.getBuffer();
    const limit = Math.min(options.limit ?? 100, 1_000);

    const includes = options.include
      ? options.include
          .split(',')
          .map((pattern) => pattern.trim())
          .filter(Boolean)
      : [];

    const excludes = options.exclude
      ? options.exclude
          .split(',')
          .map((pattern) => pattern.trim())
          .filter(Boolean)
      : [];

    const sortedBuffer = buffer.toSorted((a, b) => a.timestamp - b.timestamp);

    const results: Array<{ raw: string; timestamp: number }> = [];

    for (const entry of sortedBuffer) {
      const raw = stripAnsi(entry.line);

      const matchesIncludes =
        includes.length === 0 ||
        includes.some((pattern) =>
          raw.toLowerCase().includes(pattern.toLowerCase()),
        );

      const matchesExcludes = excludes.some((pattern) =>
        raw.toLowerCase().includes(pattern.toLowerCase()),
      );

      if (matchesIncludes && !matchesExcludes) {
        results.push({ raw, timestamp: entry.timestamp });

        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
  }

  private getProcessNames(): string[] {
    const buffer = this.getBuffer();
    const names = new Set<string>();

    for (const entry of buffer) {
      const raw = stripAnsi(entry.line);
      // Process names are in the format [name] at the start of the line
      const match = /^\[([^\]]+)\]/u.exec(raw);

      if (match) {
        names.add(match[1]);
      }
    }

    return [...names].toSorted();
  }

  private async handleDelete(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    sessionId: string | undefined,
  ): Promise<void> {
    if (!sessionId || !this.transports[sessionId]) {
      response.writeHead(400);
      response.end('Invalid session');
      return;
    }

    const transport = this.transports[sessionId];

    await transport.handleRequest(request, response);
  }

  private async handleGet(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    sessionId: string | undefined,
  ): Promise<void> {
    if (!sessionId || !this.transports[sessionId]) {
      response.writeHead(400);
      response.end('Invalid session');
      return;
    }

    const transport = this.transports[sessionId];

    await transport.handleRequest(request, response);
  }

  private async handlePost(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    body: string,
    sessionId: string | undefined,
  ): Promise<void> {
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(body);
    } catch {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          error: { code: -32_700, message: 'Parse error' },
          id: null,
          jsonrpc: '2.0',
        }),
      );
      return;
    }

    let transport: StreamableHTTPServerTransport;

    if (sessionId && this.transports[sessionId]) {
      transport = this.transports[sessionId];
    } else if (!sessionId && isInitializeRequest(parsedBody)) {
      transport = new StreamableHTTPServerTransport({
        onsessioninitialized: (id) => {
          this.transports[id] = transport;
        },
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        const { sessionId: closedSessionId } = transport;
        if (closedSessionId) {
          this.transports = Object.fromEntries(
            Object.entries(this.transports).filter(
              ([key]) => key !== closedSessionId,
            ),
          );
        }
      };

      const server = this.createMcpServer();
      await server.connect(transport);
    } else {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          error: { code: -32_000, message: 'Invalid session' },
          id: null,
          jsonrpc: '2.0',
        }),
      );
      return;
    }

    await transport.handleRequest(request, response, parsedBody);
  }
}
