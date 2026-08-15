# Interactive Student Experiences

Topic in → a standards-grounded learning pathway, with an interactive widget for every step.

Type a topic. The model proposes standard codes, a standards graph confirms or rejects them,
and the verified facts ground a pathway of 4–6 steps. Every step is something a student
*does* — one of 16 interactive widgets, configured against the step it serves.

Teachers can build a pathway from a topic or an uploaded lesson plan, keep a roster, assign
pathways to students, and read back what each student actually did.

## The pipeline

```
topic ──▶ model proposes standard codes        ("3.NF.A.1", "3.G.A.2", …)
            │
            ▼
        standards source  verify        ── rejects hallucinated codes
            │                              first survivor becomes the anchor
            ▼
        standards source  decompose     ── the authoritative skill decomposition
                          progression   ── prerequisite standards to activate
            │
            ▼
        model authors the pathway from verified facts    ── outcomes bound to component ids
            │
            ▼
        model configures one widget per step  ──▶  <WidgetRenderer/> registry
```

The interesting property is the direction of authority. The Learning Commons graph has
**no topic search** — all three of its tools are code-first — so the model must guess a
standard code, and the graph then confirms or rejects it. Guesses are cheap; the graph is
the source of truth. Rejected codes are surfaced in the UI rather than swallowed.

A topic that resolves to no standard still produces a pathway, marked as exploration rather
than standards-aligned. A widget that doesn't fit the anchor standard is substituted, with a
note saying so. Degrading loudly is the design.

## Run it

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

**The minimum is one LLM API key.** With `STANDARDS_SOURCE=example` and no storage
configured, nothing else is needed — no Learning Commons account, no Supabase, no cloud
setup. The example source is a deliberately small six-standard set (two fractions, forces
and motion, reading evidence, Reconstruction, written argument): topics inside it verify
normally, and topics outside it produce an exploration pathway.

For real standards coverage set `STANDARDS_SOURCE=learning-commons` and a
`LEARNING_COMMONS_API_KEY`. For persistence beyond a single process, configure Supabase and
run `pnpm db:start`.

[`.env.example`](.env.example) documents every variable and which combinations need which.

### Choosing a model provider

All three are resolved in [`src/lib/model.ts`](src/lib/model.ts) and selected by
`LLM_PROVIDER`, so switching is config, not code.

**OpenRouter** — the lowest-setup option. Set `LLM_PROVIDER=openrouter` and
`OPENROUTER_API_KEY`.

**First-party Anthropic** (default) — set `ANTHROPIC_API_KEY`.

**Amazon Bedrock** — set `LLM_PROVIDER=bedrock` plus:

```bash
AWS_BEARER_TOKEN_BEDROCK=...              # Bedrock API key (bearer token)
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-opus-5
```

Omit `AWS_BEARER_TOKEN_BEDROCK` and the provider falls back to normal SigV4
credential resolution (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, instance role, …).

Two Bedrock gotchas worth knowing up front:

- **Model access is per-account and per-region.** Enable the Claude model in the Bedrock
  console for your region first, or every call 403s.
- **Inference profiles.** Newer Claude models are served on-demand only through a
  cross-region inference profile, which is the `us.`-prefixed id. A
  `on-demand throughput isn't supported` error means the bare `anthropic.…` id needs
  the `us.` prefix.

## The four seams

Each is a registry with more than one real implementation, chosen by environment variable.

| Seam | Variable | Implementations |
|---|---|---|
| Standards source | `STANDARDS_SOURCE` | `learning-commons` (live MCP graph), `example` (in-memory). Comma-separate to try several in priority order. |
| Storage | `STORAGE_ADAPTER` | `supabase`, `memory` (the default when Supabase is unconfigured) |
| Model provider | `LLM_PROVIDER` | `anthropic`, `openrouter`, `bedrock` |
| Widget registry | — | 16 widgets; add one without editing the pipeline |

## Layout

```
src/lib/standards/           the standards-source registry — index.ts picks the active set
src/lib/learning-commons/    MCP client — the only thing that talks to the graph
src/lib/pathway/schema.ts    zod schemas: pathway plan + widget specs
src/lib/pathway/generate.ts  the pipeline, plus the planner's registry-built widget menu
src/lib/widgets/             the widget registry: types.ts, builtins*.ts, definitions/
src/lib/storage/             storage adapters behind one interface
src/lib/student/             telemetry events and the derived student profile
src/components/widgets/      widget implementations + registry.tsx (spec -> component)
src/app/(teacher)/           pathway builder, roster, session reports
src/app/learn/               the student-facing walkthrough
src/app/demo/                every widget, standalone, no model call needed
mcp/                         serves the widgets to an MCP host as a self-contained bundle
```

`pnpm dev` then `/demo` is the fastest way to see all 16 widgets without spending a token.

## Adding a widget

The widget is deliberately **data, not a React tree**: the model emits a spec and a registry
renders it. A new kind is a spec schema plus a definition file — the pipeline itself doesn't
change, and neither does anything that renders or plans.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the checklist.

## Where this goes next

That spec-not-tree seam is where an agent runtime plugs in. A co-design loop ("make this
harder", "add a hint") changes *how specs arrive*, not what they are — and the same specs
already serve from an MCP server as well as a route handler.

## License

Apache-2.0.
