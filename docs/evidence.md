# The evidence contract

The project exists so students *do* — think critically, practice, produce —
instead of passively consuming AI output. The extensible widgets and the
standards-verified loop are that commitment made structural. The evidence
contract is how the loop closes: when a student works through an activity,
what happened flows back in a shape a program can act on — the agent that
assigned it, the teacher's report, the remediation loop. Chat alone can't
see whether the doing happened; this contract is what makes it visible.

## The interaction event

Every widget that assesses emits events through the shared telemetry hook
(`useWidgetTelemetry`). The persisted shape
([`src/lib/storage/types.ts`](../src/lib/storage/types.ts)):

```ts
type InteractionEvent = {
  sessionId: string;
  studentId: string;          // anonymous id — see the boundary note below
  widgetKind: string;
  eventType: string;
  standardCode: string | null;
  learningComponentId: string | null;
  elapsedMs: number;
  correct: boolean | null;    // null = this event carries no verdict
  payload: Record<string, unknown>;  // per-kind detail; stepIndex rides here
};
```

`eventType` is a string by design (adapters shouldn't need a migration for a
new event), with these conventional values:

| Event | When | `correct` |
|---|---|---|
| `widget_shown` | the activity mounts | `null` |
| `answer_checked` | a checkable attempt is judged | `true` / `false` |
| `hint_requested` | the student asks for help | `null` |
| `widget_completed` | the activity's done moment | the final verdict, or `null` for non-assessing kinds |
| `hesitation` | a long pause on an open question | `null` |

Two rules keep the data honest:

- **A verdict is a claim.** In-progress work (a draft being written, an
  unfinished sort) reports `correct: null` — being mid-task is not being
  wrong. Only kinds whose catalog entry says `assesses: true` emit verdicts
  at all; see [the registry](./registry.md).
- **`stepIndex` rides inside `payload`.** In a pathway, `widget_completed`
  carries which step it was, which is what makes per-step reporting possible.

## What reads it

- **The session report** aggregates per-student accuracy, attempts, hints,
  median time, and a per-step evidence strip (first try / needed attempts /
  still wrong / not reached — the strip never guesses about events recorded
  before `stepIndex` existed).
- **The remediation loop** watches `widget_completed` verdicts; a wrong one
  can inject a re-teach step after the student's current position. Injected
  steps are announced, and cost the student nothing.
- **The student profile** weights later pathway generation toward what a
  student found hard.
- **A hosting agent** — in a chat host, finish-line results are also
  reported into the conversation in prose, so the assistant that assigned
  the activity can adapt.

## The boundary

`studentId` is an anonymous identifier minted by the deployment. No
integration path sends a student's identity to this server; when the
reference app's optional roster maps anonymous ids to names, that mapping
lives in **your** storage adapter, inside **your** deployment, and never
leaves it. Educator identity may eventually reach the server edge (OAuth for
hosted instances is on the roadmap); student identity never does.

## Where the contract is going

v0.1's headline work is a **universal `WidgetResult`** — one typed result
shape across all sixteen kinds (status, verdict, attempts, and a per-kind
`detail` naming what the struggle was), so an SDK consumer writes one
`onResult` handler, not sixteen. The event stream above stays; the result is
its per-activity summary. An xAPI statement export for LRS pipelines is a
mapping over this contract, not a rewrite, and sits on the pull-gated
roadmap.
