<p align="center">
  <img src="assets/teemux.png" alt="teemux" width="120" />
</p>

<h1 align="center">teemux</h1>

<p align="center">
  <strong>Aggregate logs from multiple processes in a single view</strong>
</p>

<p align="center">
  View in browser or terminal • Filter with patterns • Stream to AI agents via MCP
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/teemux"><img src="https://img.shields.io/npm/v/teemux.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/teemux"><img src="https://img.shields.io/npm/dm/teemux.svg" alt="npm downloads" /></a>
  <a href="https://github.com/gajus/teemux/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/teemux.svg" alt="license" /></a>
</p>

---

## Motivation

* Needed a simple way to browse logs aggregated across multiple processes.
* Needed a simple way to give agents a unified view of all the logs

## Install

```bash
npm install -g teemux
```

## Usage

```bash
teemux --name api -- node api.js
teemux --name worker -- node worker.js
teemux -- redis-server  # name defaults to "redis-server"
```

The first process starts a local server on port 8336. Others connect automatically.

### Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--name` | `-n` | command name | Identifier for this process in logs |
| `--port` | `-p` | 8336 | Port for the log aggregation server |
| `--buffer` | `-b` | 10000 | Number of log lines to keep in server buffer |
| `--force-leader` | `-f` | false | Force this process to become the leader, replacing any existing leader |

All options can also be set via environment variables with `TEEMUX_` prefix:

```bash
TEEMUX_PORT=9000 teemux -- node app.js
```

## Viewing Logs

### Browser

Open http://127.0.0.1:8336/ to view aggregated logs with:

- Color-coded process names
- Auto-scroll (sticks to bottom like a terminal)
- Scroll up to pause, scroll back down to resume

### Terminal / curl

```bash
curl http://127.0.0.1:8336/
```

Plain text stream of all logs.

### MCP Server for AI Agents

teemux includes a built-in [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that enables AI agents to programmatically access logs in your development environment. This makes it easy for coding assistants like Claude, Cursor, or other AI tools to inspect application logs, search for errors, and understand what's happening in your running processes.

The MCP server runs on the same port as the HTTP server at `/mcp` and provides these tools:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_logs` | Get recent logs from buffer | `limit?`, `include?`, `exclude?` |
| `search_logs` | Search logs with patterns | `limit?`, `include?`, `exclude?` |
| `clear_logs` | Clear the log buffer | none |
| `get_process_names` | List all process names that have logged | none |

#### Configuring your AI agent

Add teemux as an MCP server in your AI tool's configuration. For Claude Code, add to your MCP settings:

```json
{
  "mcpServers": {
    "teemux": {
      "url": "http://127.0.0.1:8336/mcp"
    }
  }
}
```

Once configured, your AI agent can:
- **Inspect logs** when debugging issues ("What errors are in the logs?")
- **Search for specific events** ("Find all database connection errors")
- **Monitor processes** ("What processes are currently running?")
- **Clear logs** to start fresh when testing

#### Example MCP usage

```bash
# Initialize session
curl -X POST http://127.0.0.1:8336/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'

# List available tools (use session ID from response above)
curl -X POST http://127.0.0.1:8336/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'

# Get recent logs
curl -X POST http://127.0.0.1:8336/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get_logs","arguments":{"limit":50}},"id":3}'
```

### Filtering Logs

Use query parameters to filter logs:

| Parameter | Logic | Description |
|-----------|-------|-------------|
| `include` | OR | Show lines matching **any** of the patterns |
| `exclude` | OR | Hide lines matching **any** of the patterns |

Patterns support `*` as a wildcard (matches any characters):

```bash
# Show only logs from the api process
curl "http://127.0.0.1:8336/?include=api"

# Show only error logs (using wildcard)
curl "http://127.0.0.1:8336/?include=*error*"

# Show logs from api OR worker
curl "http://127.0.0.1:8336/?include=api,worker"

# Hide healthcheck and ping logs
curl "http://127.0.0.1:8336/?exclude=health*,ping"

# Show GET requests to /api endpoints
curl "http://127.0.0.1:8336/?include=*GET*/api*"

# Show api logs but exclude verbose debug output
curl "http://127.0.0.1:8336/?include=api&exclude=DEBUG,TRACE"

# In browser
open "http://127.0.0.1:8336/?include=api&exclude=health*"
```

Filters apply to both buffered logs and new incoming logs in real-time.

## Output Example

**Terminal (where teemux runs):**
```
● started (pid 12345)
Server listening on :3000
Processing jobs...
GET /health 200
○ exited (code 0)
```

**Browser / curl (aggregated with prefixes):**
```
[api] ● started (pid 12345)
[api] Server listening on :3000
[worker] Processing jobs...
[api] GET /health 200
[worker] ○ exited (code 0)
```

## FAQ

### What's the origin of the name?

The name combines **tee** (the Unix command that duplicates output) and **mux** (multiplexer) – it multiplexes multiple log streams into one.

### How does teemux work?

teemux uses automatic leader discovery to coordinate log aggregation across multiple processes:

1. **Leader Discovery**: When the first teemux process starts, it attempts to bind to the configured port (default 8336). If successful, it becomes the **leader** and starts the log aggregation server.

2. **Client Registration**: When subsequent teemux processes start, they detect the port is already in use, verify a server is responding, and automatically become **clients** that forward their logs to the leader.

3. **Leader Election**: If the leader process exits, clients detect this through periodic health checks (every 2 seconds). When a client detects the leader is gone, it attempts to become the new leader. Random jitter prevents multiple clients from racing to claim leadership simultaneously.

This design requires no configuration – just run multiple `teemux` commands and they automatically coordinate.

### Docker output appears corrupted with strange spacing

When running Docker with the `-t` flag, output may appear corrupted:

```
Initializing database...
                        The files belonging to this database system...
```

**Cause:** The `-t` flag allocates a pseudo-TTY, which adds terminal control sequences (cursor positioning, colors, etc.) to the output. These sequences are meant for interactive terminal use, not for piping.

**Solution:** Remove the `-t` flag when running through teemux:

```bash
# ❌ Don't use -t
teemux --name db -- docker run --rm -it my-database

# ✅ Use -i only (or neither flag)
teemux --name db -- docker run --rm -i my-database
teemux --name db -- docker run --rm my-database
```

The flags:
- `-i` = keep stdin open (for interactive input) ✅
- `-t` = allocate pseudo-TTY (adds terminal formatting) ❌

## Developing

```bash
# Install dependencies
npm install

# Build and watch for changes
npm run dev

# In another terminal, run with fake logs
node dist/teemux.js -- node scripts/fake-logs.js
```