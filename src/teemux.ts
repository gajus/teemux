#!/usr/bin/env node

import { LogServer } from './LogServer.js';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import readline from 'node:readline';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// High-precision timestamp (milliseconds with microsecond precision)
const getTimestamp = (): number => performance.timeOrigin + performance.now();

const RESET = '\u001B[0m';
const RED = '\u001B[91m';

type LogType = 'stderr' | 'stdout';

class LogClient {
  private name: string;

  private port: number;

  private queue: Array<{ line: string; timestamp: number; type: LogType }> = [];

  private sending = false;

  constructor(name: string, port: number) {
    this.name = name;
    this.port = port;
  }

  async event(
    event: 'exit' | 'start',
    pid: number,
    code?: number,
  ): Promise<void> {
    await this.send('/event', {
      code,
      event,
      name: this.name,
      pid,
      timestamp: getTimestamp(),
    });
  }

  async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) {
      return;
    }

    this.sending = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();

      if (!item) {
        continue;
      }

      const success = await this.send('/log', {
        line: item.line,
        name: this.name,
        timestamp: item.timestamp,
        type: item.type,
      });

      if (!success) {
        // Fallback to local output if server unreachable
        // eslint-disable-next-line no-console
        console.log(`[${this.name}] ${item.line}`);
      }
    }

    this.sending = false;
  }

  log(line: string, type: LogType = 'stdout'): void {
    // Always output locally
    const errorPrefix = type === 'stderr' ? `${RED}[ERR]${RESET} ` : '';

    // eslint-disable-next-line no-console
    console.log(`${errorPrefix}${line}`);

    // Capture timestamp immediately when log is received
    this.queue.push({ line, timestamp: getTimestamp(), type });
    void this.flush();
  }

  private async send(endpoint: string, data: object): Promise<boolean> {
    return new Promise((resolve) => {
      const postData = JSON.stringify(data);
      const request = http.request(
        {
          headers: {
            'Content-Length': Buffer.byteLength(postData),
            'Content-Type': 'application/json',
          },
          hostname: '127.0.0.1',
          method: 'POST',
          path: endpoint,
          port: this.port,
          timeout: 1_000,
        },
        (response) => {
          response.resume();
          response.on('end', () => resolve(true));
        },
      );

      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
      request.write(postData);
      request.end();
    });
  }
}

const runProcess = async (
  name: string,
  command: string[],
  client: LogClient,
): Promise<number> => {
  const [cmd, ...args] = command;

  const child = spawn(cmd, args, {
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
    shell: process.platform === 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const pid = child.pid ?? 0;

  await client.event('start', pid);

  if (child.stdout) {
    const rlStdout = readline.createInterface({ input: child.stdout });

    rlStdout.on('line', (line) => client.log(line, 'stdout'));
  }

  if (child.stderr) {
    const rlStderr = readline.createInterface({ input: child.stderr });

    rlStderr.on('line', (line) => client.log(line, 'stderr'));
  }

  return new Promise((resolve) => {
    child.on('close', async (code) => {
      await client.flush();
      await client.event('exit', pid, code ?? 0);
      resolve(code ?? 0);
    });
  });
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const checkServerReady = async (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        method: 'GET',
        path: '/',
        port,
        timeout: 200,
      },
      (response) => {
        response.resume();
        resolve(true);
      },
    );

    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.end();
  });
};

const waitForServer = async (
  port: number,
  maxAttempts = 50,
): Promise<boolean> => {
  for (let index = 0; index < maxAttempts; index++) {
    if (await checkServerReady(port)) {
      return true;
    }

    // Exponential backoff: 10ms, 20ms, 40ms, ... capped at 200ms
    const delay = Math.min(10 * 2 ** index, 200);

    await sleep(delay);
  }

  return false;
};

const main = async (): Promise<void> => {
  const argv = await yargs(hideBin(process.argv))
    .env('TEEMUX')
    .usage('Usage: $0 --name <name> -- <command> [args...]')
    .option('name', {
      alias: 'n',
      description:
        'Name to identify this process in logs (defaults to command)',
      type: 'string',
    })
    .option('port', {
      alias: 'p',
      default: 8_336,
      description: 'Port for the log aggregation server',
      type: 'number',
    })
    .option('tail', {
      alias: 't',
      default: 1_000,
      description: 'Number of log lines to keep in buffer',
      type: 'number',
    })
    .help()
    .parse();

  const command = argv._ as string[];

  if (command.length === 0) {
    // eslint-disable-next-line no-console
    console.error('No command specified');
    // eslint-disable-next-line no-console
    console.error('Usage: teemux --name <name> -- <command> [args...]');
    process.exit(1);
  }

  const name = argv.name ?? command[0] ?? 'unknown';
  const port = argv.port;

  const server = new LogServer(port, argv.tail);

  // Try to become server with retries - if port is taken, become client
  let isServer = false;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await server.start();
      isServer = true;
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
        throw error;
      }

      // Check if another server is actually running
      if (await checkServerReady(port)) {
        // Server exists, we're a client
        break;
      }

      // Port in use but server not responding - might be starting up
      // Add random jitter to avoid thundering herd
      const jitter = Math.random() * 100;

      await sleep(50 + jitter);
    }
  }

  // If we're not the server, wait for it to be ready
  if (!isServer) {
    const serverReady = await waitForServer(port);

    if (!serverReady) {
      // eslint-disable-next-line no-console
      console.error(
        '[teemux] Could not connect to server. Is another instance running?',
      );
    }
  }

  const client = new LogClient(name, port);

  // Run the process
  const exitCode = await runProcess(name, command, client);

  process.exit(exitCode);
};

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', error);
  process.exit(1);
});
