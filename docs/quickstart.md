# Quickstart

Two paths in: point an MCP host at a running instance, or run your own.

## Point an agent at it

Any MCP host that renders MCP Apps (Claude does) can use the server with zero
code. Add the instance as a custom connector:

```json
{ "mcpServers": { "a2learn": { "url": "https://your-instance.example/api/mcp" } } }
```

Then ask for practice in plain words — "a quick activity on the water cycle
for a 5th grader." The agent calls `show_widget`, the standard is verified
against the graph, and the activity renders inline. See
[MCP tools](./mcp-tools.md) for the full tool surface.

## Run your own instance

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

One secret is required: an LLM key. Everything else has a working default —
no database, no accounts.

```bash
# .env.local — minimal
ANTHROPIC_API_KEY=sk-ant-...
```

Deploy is one Vercel deploy of the repo with the same env vars.

## Configuration

One required secret (the LLM key); everything else defaults. The
[configuration reference](./configuration.md) lists every variable —
including the two operational warnings worth reading before deploying
anywhere public.

## What you just ran

The same process serves three surfaces: the MCP endpoint (`/api/mcp`), a REST
mirror for direct calls (`/api/widget`), and the reference teacher/student app
at `/`. The app is the demo of the server, not the product you must adopt —
[Architecture](./architecture.md) shows where the seams are.
