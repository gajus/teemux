import { runWithTeemux } from './testing/runWithTeemux.js';
import http from 'node:http';
import { describe, expect, it } from 'vitest';

type McpResponse = {
  error?: {
    code: number;
    message: string;
  };
  id: null | number;
  jsonrpc: string;
  result?: unknown;
};

const mcpRequest = (
  port: number,
  method: string,
  body: Record<string, unknown>,
  sessionId?: string,
): Promise<{ body: McpResponse; sessionId?: string }> => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const headers: Record<string, string> = {
      Accept: 'application/json, text/event-stream',
      'Content-Length': String(Buffer.byteLength(postData)),
      'Content-Type': 'application/json',
    };

    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const request = http.request(
      {
        headers,
        hostname: '127.0.0.1',
        method,
        path: '/mcp',
        port,
      },
      (response) => {
        let data = '';
        response.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        response.on('end', () => {
          try {
            // MCP responses come as SSE events
            const match = /^event: message\ndata: (.+)$/mu.exec(data);
            const jsonData = match ? match[1] : data;
            const parsed = JSON.parse(jsonData) as McpResponse;
            const responseSessionId = response.headers[
              'mcp-session-id'
            ] as string;
            resolve({ body: parsed, sessionId: responseSessionId });
          } catch {
            reject(new Error(`Failed to parse MCP response: ${data}`));
          }
        });
      },
    );

    request.on('error', reject);
    request.write(postData);
    request.end();
  });
};

const initializeSession = async (
  port: number,
): Promise<{ sessionId: string }> => {
  const response = await mcpRequest(port, 'POST', {
    id: 1,
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
      protocolVersion: '2025-03-26',
    },
  });

  if (!response.sessionId) {
    throw new Error('No session ID returned from initialize');
  }

  return { sessionId: response.sessionId };
};

const callTool = async (
  port: number,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  id: number = 2,
): Promise<McpResponse> => {
  const response = await mcpRequest(
    port,
    'POST',
    {
      id,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: args,
        name: toolName,
      },
    },
    sessionId,
  );

  return response.body;
};

describe('McpHandler', () => {
  describe('session management', () => {
    it('initializes a new session', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        const response = await mcpRequest(context.port, 'POST', {
          id: 1,
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' },
            protocolVersion: '2025-03-26',
          },
        });

        expect(response.sessionId).toBeDefined();
        expect(response.body.result).toBeDefined();
        expect(response.body.result).toMatchObject({
          capabilities: { tools: { listChanged: true } },
          protocolVersion: '2025-03-26',
          serverInfo: { name: 'teemux', version: '1.0.0' },
        });
      });
    });

    it('rejects requests without session ID after initialization', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        // Try to list tools without initializing
        const response = await mcpRequest(context.port, 'POST', {
          id: 1,
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
        });

        expect(response.body.error).toBeDefined();
        expect(response.body.error?.code).toBe(-32_000);
        expect(response.body.error?.message).toBe('Invalid session');
      });
    });

    it('accepts requests with valid session ID', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        const { sessionId } = await initializeSession(context.port);

        const response = await mcpRequest(
          context.port,
          'POST',
          {
            id: 2,
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
          },
          sessionId,
        );

        expect(response.body.error).toBeUndefined();
        expect(response.body.result).toBeDefined();
      });
    });
  });

  describe('tools/list', () => {
    it('returns all available tools', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        const { sessionId } = await initializeSession(context.port);

        const response = await mcpRequest(
          context.port,
          'POST',
          {
            id: 2,
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {},
          },
          sessionId,
        );

        const result = response.body.result as {
          tools: Array<{ name: string }>;
        };
        const toolNames = result.tools.map((tool) => tool.name);

        expect(toolNames).toContain('get_logs');
        expect(toolNames).toContain('search_logs');
        expect(toolNames).toContain('clear_logs');
        expect(toolNames).toContain('get_process_names');
      });
    });
  });

  describe('get_logs tool', () => {
    it('returns recent logs from the buffer', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('api', 'request received');
        await context.injectLog('worker', 'job started');

        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(context.port, sessionId, 'get_logs', {
          limit: 10,
        });

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const logs = JSON.parse(result.content[0].text) as Array<{
          raw: string;
        }>;

        expect(logs.length).toBe(2);
        expect(logs.map((log) => log.raw)).toContain('[api] request received');
        expect(logs.map((log) => log.raw)).toContain('[worker] job started');
      });
    });

    it('respects the limit parameter', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('app', 'message 1');
        await context.injectLog('app', 'message 2');
        await context.injectLog('app', 'message 3');
        await context.injectLog('app', 'message 4');
        await context.injectLog('app', 'message 5');

        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(context.port, sessionId, 'get_logs', {
          limit: 3,
        });

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const logs = JSON.parse(result.content[0].text) as Array<{
          raw: string;
        }>;

        expect(logs.length).toBe(3);
      });
    });

    it('filters logs with include parameter', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('api', 'GET /users');
        await context.injectLog('worker', 'processing job');
        await context.injectLog('api', 'POST /orders');

        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(context.port, sessionId, 'get_logs', {
          include: 'api',
          limit: 10,
        });

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const logs = JSON.parse(result.content[0].text) as Array<{
          raw: string;
        }>;

        expect(logs.length).toBe(2);
        expect(logs.every((log) => log.raw.includes('api'))).toBe(true);
      });
    });

    it('filters logs with exclude parameter', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('api', 'GET /health');
        await context.injectLog('api', 'GET /users');
        await context.injectLog('api', 'GET /health');

        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(context.port, sessionId, 'get_logs', {
          exclude: 'health',
          limit: 10,
        });

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const logs = JSON.parse(result.content[0].text) as Array<{
          raw: string;
        }>;

        expect(logs.length).toBe(1);
        expect(logs[0].raw).toBe('[api] GET /users');
      });
    });
  });

  describe('search_logs tool', () => {
    it('searches logs with include pattern', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('api', 'error: connection failed');
        await context.injectLog('api', 'info: request completed');
        await context.injectLog('worker', 'error: timeout');

        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(
          context.port,
          sessionId,
          'search_logs',
          {
            include: 'error',
            limit: 10,
          },
        );

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const logs = JSON.parse(result.content[0].text) as Array<{
          raw: string;
        }>;

        expect(logs.length).toBe(2);
        expect(logs.every((log) => log.raw.includes('error'))).toBe(true);
      });
    });
  });

  describe('get_process_names tool', () => {
    it('returns all process names that have logged', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('api', 'message');
        await context.injectLog('worker', 'message');
        await context.injectLog('scheduler', 'message');
        await context.injectLog('api', 'another message');

        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(
          context.port,
          sessionId,
          'get_process_names',
          {},
        );

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const names = JSON.parse(result.content[0].text) as string[];

        expect(names).toEqual(['api', 'scheduler', 'worker']);
      });
    });

    it('returns empty array when no logs exist', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        const { sessionId } = await initializeSession(context.port);
        const response = await callTool(
          context.port,
          sessionId,
          'get_process_names',
          {},
        );

        const result = response.result as {
          content: Array<{ text: string; type: string }>;
        };
        const names = JSON.parse(result.content[0].text) as string[];

        expect(names).toEqual([]);
      });
    });
  });

  describe('clear_logs tool', () => {
    it('clears all logs from the buffer', async () => {
      await runWithTeemux({ buffer: 100 }, async (context) => {
        await context.injectLog('api', 'message 1');
        await context.injectLog('api', 'message 2');

        const { sessionId } = await initializeSession(context.port);

        // Verify logs exist
        const beforeClear = await callTool(
          context.port,
          sessionId,
          'get_logs',
          { limit: 10 },
        );
        const beforeResult = beforeClear.result as {
          content: Array<{ text: string; type: string }>;
        };
        const beforeLogs = JSON.parse(
          beforeResult.content[0].text,
        ) as unknown[];
        expect(beforeLogs.length).toBe(2);

        // Clear logs
        const clearResponse = await callTool(
          context.port,
          sessionId,
          'clear_logs',
          {},
        );
        const clearResult = clearResponse.result as {
          content: Array<{ text: string; type: string }>;
        };
        expect(clearResult.content[0].text).toBe('Logs cleared successfully');

        // Verify logs are cleared
        const afterClear = await callTool(context.port, sessionId, 'get_logs', {
          limit: 10,
        });
        const afterResult = afterClear.result as {
          content: Array<{ text: string; type: string }>;
        };
        const afterLogs = JSON.parse(afterResult.content[0].text) as unknown[];
        expect(afterLogs.length).toBe(0);
      });
    });
  });
});
