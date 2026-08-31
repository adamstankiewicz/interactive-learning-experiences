# How the loop works

The project's one innovation, mechanically: **practice as a tool call** — an
agent invokes a verified learning activity the way it invokes any function,
and the student's actual work comes back as the return value. This page
walks the loop through the code: one request edge in, three return edges
out.

```
agent/host ──① ask──► ② verify ──► manufacture ──► render ──③ student works
     ▲                                                          │
     └── ④a prose into the conversation                         │ typed events
         ④b remediation injected mid-walkthrough  ◄─────────────┤
         ④c teacher report and student profile    ◄─────────────┘
```

## ① Ask

An agent calls `show_widget` on `/api/mcp` with a topic or a standard code;
a product backend can hit the REST mirror instead. Discovery-first flows go
through `find_activity`, which ranks listings derived from
[registry](./registry.md) metadata — each listing carries the exact
`show_widget` arguments that would build it, because the inventory is
generative, not a shelf.

## ② Verify, then manufacture

`buildWidget` has the model propose candidate standard codes, then the
pluggable standards source's `verify()` checks each against the graph.
`null` means the model hallucinated the code — surfaced as an error, never
built on. If nothing verifies, the activity is still built but explicitly
labeled exploration: degraded honestly rather than dressed up.

A kind is chosen through the registry's `coverageRule` and planner
metadata, that kind's server-side generator makes one model call, and the
output must validate against the kind's Zod schema. The model fills
schemas; it never emits code. A failed generation falls back to a simpler
kind, note attached.

## ③ Student works → typed evidence

The spec renders through the same component registry everywhere — the MCP
Apps shell in chat hosts, the walkthrough in the reference app. Components
emit typed events (`widget_shown`, `answer_checked`, `hint_requested`,
`widget_completed`, `hesitation`) with the honesty rules the
[evidence contract](./evidence.md) documents: in-progress work carries no
verdict, and only kinds whose registry entry says `assesses: true` carry
verdicts at all.

## ④ The loop closes on three edges

**④a — back to the assigning agent.** Inside a chat host, the widget posts
`ui/update-model-context` (MCP Apps) into the host's model context — a
prose sentence written for a model reader: *"Located the flawed step on the
second try, then misdiagnosed it as a sample-size problem."* The
assistant's next turn can act on it. Outside a host this is a no-op, so
widgets call it unconditionally.

**④b — inside the walkthrough, with no agent at all.** The telemetry
endpoint watches completion verdicts; a wrong one generates a re-teach
activity server-side and injects it after the student's current position —
announced as *just added · extra practice*, costing the student nothing.
The loop runs autonomously even when the caller is just a shared link.

**④c — to the teacher.** The same events aggregate into the session
report's per-step evidence strips, the mastery rollup, and the student
profile that weights what the next generated pathway emphasizes.

## The edge still being built

Chat hosts get prose (right for a model reader); teachers get aggregates.
The typed, programmatic return for product backends — one universal
`WidgetResult` per activity, delivered to an SDK `onResult` handler — is
designed and is v0.1's centerpiece. The events underneath it already flow;
the universal result is a summary layer over them.
