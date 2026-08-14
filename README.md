# Interactive Student Experiences

Topic in → a standards-grounded student pathway and one interactive learning widget out.

This is the first step of a larger idea: go from any topic, through the
[Learning Commons](https://mcp.learningcommons.org) knowledge graph, to a body of
interactive learning widgets. Today it produces a single pathway and a single widget.

## The pipeline

```
topic ──▶ model proposes standard codes        ("3.NF.A.1", "3.G.A.2", …)
            │
            ▼
        Learning Commons MCP  find_standard_statement   ── rejects hallucinated codes
            │                                              first survivor becomes the anchor
            ▼
        Learning Commons MCP  learning_components        ── the authoritative skill decomposition
                              progression(backward)      ── prerequisite standards to activate
            │
            ▼
        model authors the pathway from verified facts    ── outcomes bound to component ids
            │
            ▼
        model configures one widget spec  ──▶  <WidgetRenderer/> registry
```

The interesting property is the direction of authority. The graph has **no topic search** —
all three of its tools are code-first — so the model must guess a standard code, and the
graph then confirms or rejects it. Guesses are cheap; the graph is the source of truth.
Rejected codes are surfaced in the UI rather than swallowed.

## What's real vs. what's stubbed

| | Status |
|---|---|
| Learning Commons MCP integration | Real. All three tools, verified against production. |
| Standard verification + rejection | Real. Bogus codes resolve to `null` and are reported. |
| Learning components, prerequisites | Real, from the graph. |
| Pathway authoring | Real model call, grounded in graph output. |
| Widget generators | **One**: `fraction-area-model` (3–5.NF). |

**Math-only data, by design of the source.** Learning components and progressions exist
for CCSS-M only. An ELA standard like `RI.5.2` resolves its statement fine but returns no
components — the pipeline degrades to authoring outcomes directly and says so, rather than
pretending. Likewise, a non-fraction topic produces a full pathway and an explicit note that
no widget generator is registered for it yet. That honesty is the point of a first step.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in both keys
pnpm dev
```

`LEARNING_COMMONS_API_KEY` is always required. For the LLM calls, pick a provider —
all three are resolved in [`src/lib/model.ts`](src/lib/model.ts) and selected by
`LLM_PROVIDER`, so switching is config, not code.

**OpenRouter** — the lowest-setup option. Set `LLM_PROVIDER=openrouter` and
`OPENROUTER_API_KEY`. Model id is `anthropic/claude-opus-5`; same $5/$25 per M and
1M context as first-party.

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

## Layout

```
src/lib/learning-commons/client.ts   MCP client — the only thing that talks to the graph
src/lib/pathway/schema.ts            zod schemas: pathway plan + widget specs
src/lib/pathway/generate.ts          the five-stage pipeline
src/app/api/pathway/route.ts         POST { topic, gradeHint }
src/components/widgets/registry.tsx  spec -> component; the extension point
src/components/widgets/              widget implementations
```

## Adding a widget type

Three edits, nothing else:

1. A spec schema in `pathway/schema.ts`, added to the `widgetSpec` union.
2. A generator branch in `pathway/generate.ts`.
3. A `case` in `registry.tsx` — the exhaustive switch makes a missing one a type error.

## Where this goes next

The widget is deliberately **data, not a React tree**: the model emits a spec and a registry
renders it. That is the seam an agent runtime plugs into. Swapping in CopilotKit/AG-UI for a
co-design loop ("make this harder", "add a hint") changes *how specs arrive*, not what they
are — and the same specs could be served from an MCP server of our own rather than a route
handler.
