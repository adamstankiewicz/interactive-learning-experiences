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

> **Public instances:** anyone who has your URL can spend your LLM budget.
> Keep instances private until token auth (`MCP_ACCESS_TOKEN`, planned for
> v0.1) lands, or put your own gateway in front.

## Configuration reference

| Variable | Default | What it does |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | Which provider builds activities: `anthropic`, `openai`, `bedrock`, or `openrouter` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | — | The key for the chosen provider |
| `AWS_REGION`, `AWS_BEARER_TOKEN_BEDROCK` | `us-west-2`, — | Bedrock configuration when `LLM_PROVIDER=bedrock` |
| `OPENAI_FALLBACK_API_KEY`, `OPENAI_FALLBACK_MODEL_ID` | —, `gpt-4o-mini` | Optional second provider used when the primary fails |
| `STANDARDS_SOURCE` | `learning-commons` | Which standards graph verifies codes; `example` is the built-in keyless source |
| `LEARNING_COMMONS_API_KEY`, `LEARNING_COMMONS_MCP_URL` | — | Credentials for the default standards source |
| `STORAGE_ADAPTER` | `memory` | `memory` (nothing persists across restarts) or `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | — | Only when `STORAGE_ADAPTER=supabase`; `pnpm db:start` runs a local stack |
| `SEED_DEMO_ROSTER` | off | Seeds demo students in the reference app |

Model calls run under **your** keys, inside **your** deployment — scoring a
student's work never leaves the instance you control.

## What you just ran

The same process serves three surfaces: the MCP endpoint (`/api/mcp`), a REST
mirror for direct calls (`/api/widget`), and the reference teacher/student app
at `/`. The app is the demo of the server, not the product you must adopt —
[Architecture](./architecture.md) shows where the seams are.
