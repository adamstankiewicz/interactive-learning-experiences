# a2learn docs

The [landing page](./index.html) carries the why; these pages carry the
how. Start from who you are:

- **Building an AI tutor?** [Quickstart](./quickstart.md) →
  [The evidence contract](./evidence.md) — point your agent at the server,
  then read what flows back when a student works.
- **Evaluating for a platform or district?**
  [How the loop works](./the-loop.md) → [Architecture](./architecture.md)
  — the mechanism end to end, then the seams and where student data
  cannot go.
- **An educator or instructional designer?**
  [The learning science behind the design](./pedagogy.md) — every
  structural choice, traced to its finding.
- **Contributing an activity kind or a standards source?**
  [The widget registry](./registry.md) →
  [CONTRIBUTING](../CONTRIBUTING.md).

## All pages

**Learn** — how and why it works

| Page | Answers |
|---|---|
| [How the loop works](./the-loop.md) | Practice as a tool call: one request edge in, three return edges out |
| [Pedagogy](./pedagogy.md) | The learning-science lineage of the design, and what deeper grounding is coming |
| [Architecture](./architecture.md) | The four seams, the protocol facades, and the student-data boundary |

**Guides** — get something running

| Page | Answers |
|---|---|
| [Quickstart](./quickstart.md) | Point an MCP host at it, or run your own instance, in minutes |
| [Configuration](./configuration.md) | Every environment variable, and the two operational warnings |

**Reference** — the contracts

| Page | Answers |
|---|---|
| [The widget registry](./registry.md) | The core extension API: catalog entries, generators, adding a kind |
| [MCP tools](./mcp-tools.md) | The wire surface an agent calls, shipped and planned |
| [The evidence contract](./evidence.md) | The event shapes, their honesty rules, and what reads them |

**Project** — for people who represent it

| Page | Answers |
|---|---|
| [Messaging guide](./messaging.md) | The sentence, the category, the claim-hygiene rules, and the boilerplate — so everyone pitches it identically |

The a2learn document format draft (surface + manifest, conformance classes)
lives separately under `docs/a2learn/` once its branch merges.

Two ground rules that shape everything here:

1. **The model never writes code that runs.** Generated output fills Zod
   schemas that render against components humans wrote and reviewed.
2. **Student identity never reaches this server from an integration.**
   Anonymous ids only on the wire; anything richer lives in the host.
