# MCP tools

The server's wire surface for agents, served at `/api/mcp` (server name
`interactive-learning-widgets`, MCP Apps capable). A REST mirror of the same
service core exists at `/api/widget` for backends that don't want an MCP
handshake; logic never lives in either facade.

## `show_widget`

Builds one standards-verified activity and renders it in the host.

| Input | Required | Meaning |
|---|---|---|
| `topic` | no* | What the activity is about, in plain words — "comparing fractions". Enough on its own. |
| `standardCode` | no* | A Common Core or NGSS code, if the caller already knows which one it wants. |
| `gradeHint` | no | e.g. `"8th grade"` — narrows proposal and generation. |
| `kind` | no | One of the registry's kinds. Leave it out and the best interaction for the standard is chosen via `coverageRule` + planner metadata. |

*At least one of `topic` / `standardCode` in practice — a bare call has
nothing to build from.

The flow behind it: propose (or accept) a standard code → **verify it against
the standards graph** (a hallucinated code gets an error naming the problem,
not a quietly wrong activity) → pick a kind → run that kind's
[generator](./registry.md) → validate the spec → return the rendered widget
via the MCP Apps shell. When no code survives verification, the result says
so plainly and renders as an exploration activity.

## `build_pathway`

The full pipeline as one tool call (about half a minute): plans 4–6
sequenced activities against a verified standard, persists the session, and
returns a student link (`/learn/{sessionId}`) plus a structured plan
summary. Use it when someone wants a complete lesson to hand off; an
instance without persistent storage says so honestly instead of returning a
dead link. *(Implemented on `feat/mcp-pathway-and-reporting`, merging with
v0.1.)*

## Two ways to run a sequence

`build_pathway` is for handing a lesson off. In a live conversation, **the
agent is the sequencer** — and that pattern needs no extra tool:

1. Call `show_widget` for the first activity.
2. The widget reports what the student did back into the conversation.
3. Decide what the evidence calls for; call `show_widget` again.

That adaptive loop is the product demonstrated in its purest form: the
pathway plan lives in the agent's judgment, informed by verified evidence
after every step, instead of being fixed up front.

## What the widget says back

Widgets report into the conversation over `ui/update-model-context`
(MCP Apps). The channel carries two things per message:

- **A prose sentence written for a model reader** — "The student worked
  through the drag-sort (3.NF.A.2) and got it right. It took two
  attempts." Prose leads because it is what the model responds to.
- **A structured block alongside** — `widget_result` (kind, standard,
  correct, attempts, hints used, score, per-kind detail) so exact fields
  survive without parsing English. This is the same shape the SDK's
  universal `WidgetResult` converges on.

Reporting is deliberately quiet: one message at completion, plus at most
one early **struggle signal** — after three wrong checks without a finish,
the conversation hears about stuck work once, so an agent can help before
the finish line instead of only after it.

## `score_draft`

Scores a student's written response for the draft-meter kind — the model call
runs server-side, under the instance's keys, so a chat host never needs its
own scoring path.

## The widget shell

Widgets render in hosts through a prebuilt HTML shell shipped as the
`learning-widget` MCP resource. It's compiled from the same component
registry the app uses (`pnpm mcp:build`). Rebuild it whenever registry
components change — a stale committed shell means new kinds silently fail in
MCP hosts (a CI rebuild-and-diff guard for exactly this ships with the OSS
hardening branch set).

## Planned surface (v0.1)

- **`find_activity`** — answers a learning need with ranked,
  standards-verified listings derived from registry metadata; each listing
  carries the exact `show_widget` arguments that build it. Implemented on
  `feat/find-activity-mvp`, merging as part of v0.1.
- **`MCP_ACCESS_TOKEN`** — bearer auth for public instances, with a rate
  cap.
- **`/api/v0/activities`** — a small, OpenAPI-documented REST facade
  (find / create / fetch frozen instance) with the same shapes as the MCP
  tools.
