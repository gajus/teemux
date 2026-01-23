#!/usr/bin/env node

/**
 * Development utility that generates random log output to test teemux.
 * Produces a mix of JSON and plain text logs with varying lengths and values.
 *
 * Usage: node scripts/fake-logs.js
 * With teemux: teemux "node scripts/fake-logs.js"
 */

const processNames = ['api', 'worker', 'db', 'auth', 'cache', 'queue', 'scheduler'];
const logLevels = ['debug', 'info', 'warn', 'error'];
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const endpoints = [
  '/api/users',
  '/api/users/:id',
  '/api/posts',
  '/api/posts/:id/comments',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/search',
  '/api/upload',
  '/api/webhooks',
  '/health',
];
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'curl/7.79.1',
  'PostmanRuntime/7.29.0',
  'axios/1.4.0',
];
const errorMessages = [
  'Connection timeout',
  'Invalid token',
  'Resource not found',
  'Rate limit exceeded',
  'Database connection failed',
  'Invalid request body',
  'Permission denied',
  'Service unavailable',
];
const actions = [
  'Processing request',
  'Connecting to database',
  'Authenticating user',
  'Validating input',
  'Caching response',
  'Sending notification',
  'Queuing job',
  'Starting batch process',
  'Cleaning up resources',
  'Syncing data',
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomItem = (arr) => arr[randomInt(0, arr.length - 1)];
const randomBool = () => Math.random() > 0.5;
const randomId = () => Math.random().toString(36).substring(2, 10);
const randomUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

function generateHttpLog() {
  const method = randomItem(httpMethods);
  const endpoint = randomItem(endpoints).replace(':id', randomInt(1, 9999));
  const statusCode = randomItem([200, 200, 200, 201, 204, 400, 401, 403, 404, 500]);
  const duration = randomInt(5, 2000);

  return {
    level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
    method,
    path: endpoint,
    statusCode,
    duration,
    requestId: randomUuid(),
    ...(randomBool() && { userId: randomInt(1, 10000) }),
    ...(randomBool() && { userAgent: randomItem(userAgents) }),
    ...(statusCode >= 400 && { error: randomItem(errorMessages) }),
  };
}

function generateDbLog() {
  const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const tables = ['users', 'posts', 'comments', 'sessions', 'audit_logs'];
  const operation = randomItem(operations);
  const table = randomItem(tables);
  const duration = randomInt(1, 500);
  const rowCount = operation === 'SELECT' ? randomInt(0, 1000) : randomInt(1, 10);

  return {
    level: duration > 200 ? 'warn' : 'debug',
    operation,
    table,
    duration,
    rowCount,
    ...(randomBool() && { query: `${operation} * FROM ${table} WHERE id = $1` }),
  };
}

function generateAuthLog() {
  const events = ['login', 'logout', 'token_refresh', 'password_reset', 'mfa_challenge'];
  const event = randomItem(events);
  const success = randomBool();

  return {
    level: success ? 'info' : 'warn',
    event,
    success,
    userId: success ? randomInt(1, 10000) : undefined,
    ip: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    ...(randomBool() && { userAgent: randomItem(userAgents) }),
    ...(!success && { reason: randomItem(['invalid_credentials', 'account_locked', 'expired_token']) }),
  };
}

function generateWorkerLog() {
  const jobTypes = ['email', 'report', 'cleanup', 'sync', 'notification', 'export'];
  const jobType = randomItem(jobTypes);
  const status = randomItem(['started', 'completed', 'failed', 'retrying']);

  return {
    level: status === 'failed' ? 'error' : status === 'retrying' ? 'warn' : 'info',
    jobType,
    jobId: randomId(),
    status,
    ...(status === 'completed' && { duration: randomInt(100, 30000) }),
    ...(status === 'failed' && { error: randomItem(errorMessages), attempts: randomInt(1, 5) }),
    ...(randomBool() && { queue: randomItem(['high', 'default', 'low']) }),
  };
}

function generatePlainTextLog() {
  const templates = [
    () => `${randomItem(actions)}...`,
    () => `[${randomItem(logLevels).toUpperCase()}] ${randomItem(actions)}`,
    () => `Starting ${randomItem(processNames)} service on port ${randomInt(3000, 9000)}`,
    () => `Connection established to ${randomItem(['redis', 'postgres', 'mongodb'])}://${randomItem(['localhost', '127.0.0.1', 'db.internal'])}:${randomInt(3000, 9000)}`,
    () => `Loaded ${randomInt(10, 500)} records from cache`,
    () => `Memory usage: ${randomInt(50, 500)}MB / ${randomInt(512, 2048)}MB`,
    () => `Active connections: ${randomInt(1, 100)}`,
    () => `Request queued (position: ${randomInt(1, 50)})`,
    () => `Retrying in ${randomInt(1, 30)} seconds...`,
    () => `${randomItem(errorMessages)} - will retry`,
    () => `Batch ${randomInt(1, 100)}/${randomInt(100, 200)} completed`,
    () => `Health check passed`,
    () => `Configuration reloaded`,
    () => `Shutting down gracefully...`,
    () =>
      `User ${randomInt(1, 10000)} performed ${randomItem(['create', 'update', 'delete'])} on ${randomItem(['post', 'comment', 'profile'])} ${randomId()}`,
  ];

  return randomItem(templates)();
}

function generateComplexJsonLog() {
  return {
    level: randomItem(logLevels),
    message: randomItem(actions),
    timestamp: new Date().toISOString(),
    context: {
      service: randomItem(processNames),
      version: `${randomInt(1, 5)}.${randomInt(0, 20)}.${randomInt(0, 100)}`,
      environment: randomItem(['development', 'staging', 'production']),
    },
    metadata: {
      requestId: randomUuid(),
      traceId: randomUuid(),
      spanId: randomId(),
      ...(randomBool() && {
        user: {
          id: randomInt(1, 10000),
          role: randomItem(['admin', 'user', 'guest']),
        },
      }),
      ...(randomBool() && {
        performance: {
          cpu: randomInt(1, 100),
          memory: randomInt(100, 2000),
          latency: randomInt(1, 500),
        },
      }),
    },
    ...(randomBool() && {
      tags: Array.from({ length: randomInt(1, 4) }, () => randomItem(['critical', 'async', 'cached', 'external', 'internal'])),
    }),
  };
}

function generateLog() {
  const type = randomInt(1, 100);

  // 40% plain text, 60% JSON
  if (type <= 40) {
    return generatePlainTextLog();
  }

  // Different JSON log types
  if (type <= 55) return generateHttpLog();
  if (type <= 70) return generateDbLog();
  if (type <= 80) return generateAuthLog();
  if (type <= 90) return generateWorkerLog();
  return generateComplexJsonLog();
}

function emitLog() {
  const log = generateLog();
  if (typeof log === 'string') {
    console.log(log);
  } else {
    console.log(JSON.stringify(log));
  }
}

// Emit logs at random intervals
function scheduleNext() {
  const delay = randomInt(50, 1500);
  setTimeout(() => {
    emitLog();
    scheduleNext();
  }, delay);
}

// Start with a burst of logs
for (let i = 0; i < 10; i++) {
  emitLog();
}

scheduleNext();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down fake logger...');
  process.exit(0);
});
