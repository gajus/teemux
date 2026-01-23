# teemux

Aggregate logs from multiple processes in a single view – in browser or terminal.

## Motivation

* Needed a simple way to browse logs aggregated across multiple processes.
* Needed a simple way to [give agents a unified view of all the logs](#agentsmd).

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
| `--tail` | `-t` | 1000 | Number of log lines to keep in buffer |

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

### AGENTS.md

If you want your coding agent to see the logs, simply add instructions to AGENTS.md to view the logs by running `curl http://127.0.0.1:8336/`. Example:

````md
## Viewing Logs

All process logs are aggregated at http://127.0.0.1:8336/

```bash
# View all recent logs
curl http://127.0.0.1:8336/

# View logs from a specific process
curl "http://127.0.0.1:8336/?include=api"

# View only errors (using wildcard for case variations)
curl "http://127.0.0.1:8336/?include=*error*,*Error*,*ERROR*"

# View logs from api OR worker
curl "http://127.0.0.1:8336/?include=api,worker"

# Exclude noisy logs (using wildcard)
curl "http://127.0.0.1:8336/?exclude=health*,DEBUG"
```
````

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
# Terminal 1
cd src/client && pnpm run dev

# Terminal 2
node dist/teemux.js -p 1339 -- node scripts/fake-logs.js
```