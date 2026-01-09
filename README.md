# teemux

Aggregate logs from multiple processes in a single view – in browser or terminal.

## Motivation

Needed a simple way to give agents a unified view of all the logs.

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

### Filtering Logs

Use query parameters to filter logs:

| Parameter | Logic | Description |
|-----------|-------|-------------|
| `query` | AND | Show lines containing **all** patterns |
| `exclude` | OR | Hide lines containing **any** pattern |

```bash
# Show only logs from the api process
curl "http://127.0.0.1:8336/?query=[api]"

# Show only error logs
curl "http://127.0.0.1:8336/?query=[ERR]"

# Show api errors only (must contain both patterns)
curl "http://127.0.0.1:8336/?query=[api],[ERR]"

# Hide healthcheck and ping logs
curl "http://127.0.0.1:8336/?exclude=healthcheck,ping"

# Show api logs but exclude verbose debug output
curl "http://127.0.0.1:8336/?query=[api]&exclude=DEBUG,TRACE"

# In browser
open "http://127.0.0.1:8336/?query=[api]&exclude=healthcheck"
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