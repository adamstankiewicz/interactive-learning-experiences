# Architecture

One Next.js process, four deliberate seams. The app you see at `/` is the
reference client for the server underneath — adopt the seams, not the app.

```
agent / MCP host          product backend            teachers & students
      │                        │                            │
      ▼                        ▼                            ▼
 /api/mcp  ◄──────────►  /api/widget (REST)          reference app (/)
      └──────────────┬─────────────┘
                     ▼
              service core (buildWidget, pathway pipeline)
                     │
   ┌─────────────────┼──────────────────┐
   ▼                 ▼                  ▼
widget registry   standards source   storage adapter
(catalog +        (verify /          (memory | supabase)
 generators)       decompose /
                   progression)
```

## Seam 1 — the widget registry

The core extension API: catalog entries (schema + component + pedagogy
metadata) and server-only generators, covered in depth in
[registry.md](./registry.md).

## Seam 2 — the standards source

Verification is pluggable. A source implements one interface
([`src/lib/standards/types.ts`](../src/lib/standards/types.ts)):

```ts
interface StandardsSource {
  id: string;
  label: string;
  proposalPromptFragment: string;  // notation and examples for the propose step
  verify(code: string, jurisdiction?: string): Promise<StandardRef | null>;
  decompose(standard: StandardRef): Promise<LearningComponentRef[]>;
  progression(standard: StandardRef, direction: 'backward' | 'forward'): Promise<StandardRef[]>;
}
```

`verify` returning `null` is the honest answer "that code doesn't exist" —
the pipeline surfaces it instead of building on a hallucination. Learning
Commons is the default source; `src/lib/standards/example.ts` is a built-in,
keyless source that exists to be copied for a state framework, IB, or a
district curriculum map. Select with `STANDARDS_SOURCE`. Nothing downstream
assumes US notation or English.

## Seam 3 — the storage adapter

All persistence goes through one interface
([`src/lib/storage/types.ts`](../src/lib/storage/types.ts)): sessions,
interaction events, assignments, profiles. Two implementations ship —
`memory` (the default; nothing survives a restart, perfect for trying the
server) and `supabase` (a local stack via `pnpm db:start`). Select with
`STORAGE_ADAPTER`. A different backend implements the interface; report
aggregation logic is shared, not duplicated per adapter.

## Seam 4 — the protocol facades

MCP (`/api/mcp`) and REST (`/api/widget`, growing into `/api/v0`) are thin
facades over the same service core. The rule is structural: logic never
lives in a facade, so a new transport is a new file, not a fork of the
business logic. [mcp-tools.md](./mcp-tools.md) documents the surface.

## Where student data goes — and doesn't

- **Model calls** (generation, scoring) run under the deployment's own keys.
  Student work sent for scoring goes to the LLM provider *you* configured,
  from *your* instance — never to a third party of ours.
- **On the wire from integrations**, students exist only as anonymous ids.
  There is no integration path that sends student identity to this server.
- **The reference app's optional roster** (names a teacher enters) and all
  interaction evidence live in the deployment's own storage adapter. Running
  `memory`, they evaporate on restart; running your own Supabase, they're in
  your database, under your data-processing terms.
- **Educator identity** is the one identity that may eventually reach the
  server edge (per-educator OAuth for hosted multi-user instances is
  roadmapped, via an identity adapter). Student identity never does — hosts
  own students.

That boundary is the architecture expressing a value, the same way
offline-first is for Kolibri: a district evaluating this doesn't have to
trust a promise, just read where the data can't go.
