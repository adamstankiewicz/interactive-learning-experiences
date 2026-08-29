# a2learn docs

Documentation for adopters and extenders of the activity server. The
[landing page](./index.html) carries the why; these pages carry the how.

| Page | Answers |
|---|---|
| [Quickstart](./quickstart.md) | Point an MCP host at it, or run your own instance, in minutes |
| [The widget registry](./registry.md) | The core extension API: catalog entries, generators, and how a new activity kind ships |
| [MCP tools](./mcp-tools.md) | The wire surface an agent calls: `show_widget`, `score_draft`, and what's coming |
| [The evidence contract](./evidence.md) | What flows back when a student works, and what reads it |
| [Architecture](./architecture.md) | The seams — registry, standards source, storage, protocol facades — and where student data does and doesn't go |

The a2learn document format draft (surface + manifest, conformance classes)
lives separately under `docs/a2learn/` once its branch merges.

Two ground rules that shape everything here:

1. **The model never writes code that runs.** Generated output fills Zod
   schemas that render against components humans wrote and reviewed.
2. **Student identity never reaches this server from an integration.**
   Anonymous ids only on the wire; anything richer lives in the host.
