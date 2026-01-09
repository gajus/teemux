import { highlightJson } from './utils/highlightJson.js';
import { linkifyUrls } from './utils/linkifyUrls.js';
import { matchesFilters } from './utils/matchesFilters.js';
import { stripAnsi } from './utils/stripAnsi.js';
import Convert from 'ansi-to-html';
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';

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

  private port: number;

  private server: http.Server | null = null;

  private tailSize: number;

  constructor(port: number, tailSize: number = 1_000) {
    this.port = port;
    this.tailSize = tailSize;
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
            // Browser: send all logs, filtering is done client-side
            response.writeHead(200, {
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'Content-Type': 'text/html; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            });

            // Send HTML header with styling
            response.write(this.getHtmlHeader());

            // Send all buffered logs as HTML
            for (const entry of sortedBuffer) {
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
  <style>
    * { box-sizing: border-box; }
    html, body {
      height: 100%;
      margin: 0;
      overflow: hidden;
    }
    body {
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.3;
      display: flex;
      flex-direction: column;
    }
    #filter-bar {
      flex-shrink: 0;
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      background: #252526;
      border-bottom: 1px solid #3c3c3c;
    }
    #filter-bar label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #888;
    }
    #filter-bar input {
      background: #1e1e1e;
      border: 1px solid #3c3c3c;
      border-radius: 3px;
      color: #d4d4d4;
      font-family: inherit;
      font-size: 12px;
      padding: 4px 8px;
      width: 200px;
    }
    #filter-bar input:focus {
      outline: none;
      border-color: #007acc;
    }
    #container {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
    }
    .line {
      white-space: pre-wrap;
      word-break: break-all;
      padding: 1px 4px;
      margin: 0 -4px;
      border-radius: 2px;
      position: relative;
      display: flex;
      align-items: flex-start;
    }
    .line:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .line.pinned {
      background: rgba(255, 204, 0, 0.1);
      border-left: 2px solid #fc0;
      margin-left: -6px;
      padding-left: 6px;
    }
    .line-content {
      flex: 1;
    }
    .pin-btn {
      opacity: 0;
      cursor: pointer;
      padding: 0 4px;
      color: #888;
      flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .line:hover .pin-btn {
      opacity: 0.5;
    }
    .pin-btn:hover {
      opacity: 1 !important;
      color: #fc0;
    }
    .line.pinned .pin-btn {
      opacity: 1;
      color: #fc0;
    }
    a { color: #4fc1ff; text-decoration: underline; }
    a:hover { text-decoration: none; }
    mark { background: #623800; color: inherit; border-radius: 2px; }
    mark.filter { background: #264f00; }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-bool { color: #569cd6; }
    .json-null { color: #569cd6; }
    #tail-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #007acc;
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
      display: none;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: background 0.15s;
    }
    #tail-btn:hover {
      background: #0098ff;
    }
    #tail-btn svg {
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <div id="filter-bar">
    <label>Include: <input type="text" id="include" placeholder="error*,warn* (OR, * = wildcard)"></label>
    <label>Exclude: <input type="text" id="exclude" placeholder="health*,debug (OR, * = wildcard)"></label>
    <label>Highlight: <input type="text" id="highlight" placeholder="term1,term2"></label>
  </div>
  <div id="container"></div>
  <button id="tail-btn" title="Jump to bottom and follow new logs">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
    Tail
  </button>
  <script>
    const container = document.getElementById('container');
    const includeInput = document.getElementById('include');
    const excludeInput = document.getElementById('exclude');
    const highlightInput = document.getElementById('highlight');
    const tailBtn = document.getElementById('tail-btn');
    const params = new URLSearchParams(window.location.search);
    const tailSize = ${this.tailSize};
    
    includeInput.value = params.get('include') || '';
    excludeInput.value = params.get('exclude') || '';
    highlightInput.value = params.get('highlight') || '';
    
    let tailing = true;
    let pinnedIds = new Set();
    
    const updateTailButton = () => {
      tailBtn.style.display = tailing ? 'none' : 'flex';
    };
    
    // Lucide pin icon SVG
    const pinIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
    
    const stripAnsi = (str) => str.replace(/\\u001B\\[[\\d;]*m/g, '');
    
    const globToRegex = (pattern) => {
      const escaped = pattern.replace(/([.+?^\${}()|[\\]\\\\])/g, '\\\\$1');
      const regexPattern = escaped.replace(/\\*/g, '.*');
      return new RegExp(regexPattern, 'i');
    };
    
    const matchesPattern = (text, pattern) => {
      if (pattern.includes('*')) {
        return globToRegex(pattern).test(text);
      }
      return text.includes(pattern.toLowerCase());
    };
    
    const matchesFilters = (text, includes, excludes) => {
      const plain = stripAnsi(text).toLowerCase();
      if (includes.length > 0) {
        const anyMatch = includes.some(p => matchesPattern(plain, p));
        if (!anyMatch) return false;
      }
      if (excludes.length > 0) {
        const anyMatch = excludes.some(p => matchesPattern(plain, p));
        if (anyMatch) return false;
      }
      return true;
    };
    
    const highlightTerms = (html, terms, className = '') => {
      if (!terms.length) return html;
      let result = html;
      for (const term of terms) {
        if (!term) continue;
        const escaped = term.replace(/([.*+?^\${}()|[\\]\\\\])/g, '\\\\$1');
        const regex = new RegExp('(?![^<]*>)(' + escaped + ')', 'gi');
        const cls = className ? ' class="' + className + '"' : '';
        result = result.replace(regex, '<mark' + cls + '>$1</mark>');
      }
      return result;
    };
    
    const applyFilters = () => {
      const includes = includeInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const excludes = excludeInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const highlights = highlightInput.value.split(',').map(s => s.trim()).filter(Boolean);
      
      document.querySelectorAll('.line').forEach(line => {
        const id = line.dataset.id;
        const isPinned = pinnedIds.has(id);
        const text = line.dataset.raw;
        const matches = matchesFilters(text, includes, excludes);
        line.style.display = (matches || isPinned) ? '' : 'none';
        
        // Re-apply highlighting
        const contentEl = line.querySelector('.line-content');
        if (contentEl) {
          let html = line.dataset.html;
          html = highlightTerms(html, includes, 'filter');
          html = highlightTerms(html, highlights);
          contentEl.innerHTML = html;
        }
      });
      
      // Update URL without reload
      const newParams = new URLSearchParams();
      if (includeInput.value) newParams.set('include', includeInput.value);
      if (excludeInput.value) newParams.set('exclude', excludeInput.value);
      if (highlightInput.value) newParams.set('highlight', highlightInput.value);
      const newUrl = newParams.toString() ? '?' + newParams.toString() : window.location.pathname;
      history.replaceState(null, '', newUrl);
      
      // Jump to bottom and resume tailing after filter change
      container.scrollTop = container.scrollHeight;
      tailing = true;
      updateTailButton();
    };
    
    const trimBuffer = () => {
      const lines = container.querySelectorAll('.line');
      const unpinnedLines = Array.from(lines).filter(l => !pinnedIds.has(l.dataset.id));
      const excess = unpinnedLines.length - tailSize;
      if (excess > 0) {
        for (let i = 0; i < excess; i++) {
          unpinnedLines[i].remove();
        }
      }
    };
    
    let lineCounter = 0;
    const addLine = (html, raw) => {
      const id = 'line-' + (lineCounter++);
      const includes = includeInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const excludes = excludeInput.value.split(',').map(s => s.trim()).filter(Boolean);
      const highlights = highlightInput.value.split(',').map(s => s.trim()).filter(Boolean);
      
      const div = document.createElement('div');
      div.className = 'line';
      div.dataset.id = id;
      div.dataset.raw = raw;
      div.dataset.html = html;
      
      let displayHtml = html;
      displayHtml = highlightTerms(displayHtml, includes, 'filter');
      displayHtml = highlightTerms(displayHtml, highlights);
      
      div.innerHTML = '<span class="line-content">' + displayHtml + '</span><span class="pin-btn" title="Pin">' + pinIcon + '</span>';
      
      // Pin button handler
      div.querySelector('.pin-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (pinnedIds.has(id)) {
          pinnedIds.delete(id);
          div.classList.remove('pinned');
        } else {
          pinnedIds.add(id);
          div.classList.add('pinned');
        }
        applyFilters();
      });
      
      const matches = matchesFilters(raw, includes, excludes);
      div.style.display = matches ? '' : 'none';
      
      container.appendChild(div);
      trimBuffer();
      if (tailing) container.scrollTop = container.scrollHeight;
    };
    
    container.addEventListener('scroll', () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
      tailing = atBottom;
      updateTailButton();
    });
    
    tailBtn.addEventListener('click', () => {
      container.scrollTop = container.scrollHeight;
      tailing = true;
      updateTailButton();
    });
    
    let debounceTimer;
    const debounce = (fn, delay) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, delay);
    };
    
    includeInput.addEventListener('input', () => debounce(applyFilters, 50));
    excludeInput.addEventListener('input', () => debounce(applyFilters, 50));
    highlightInput.addEventListener('input', () => debounce(applyFilters, 50));
  </script>
`;
  }

  private getHtmlLine(line: string): string {
    let html = this.ansiConverter.toHtml(line);
    html = highlightJson(html);
    html = linkifyUrls(html);
    const escaped = html.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    const raw = stripAnsi(line).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
    return `<script>addLine('${escaped}', '${raw}')</script>\n`;
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
