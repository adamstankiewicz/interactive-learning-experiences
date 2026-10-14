# a2learn-events — draft v0

What interactions report back to the agent side. These are **payload
shapes with transport bindings**, not a wire protocol: a2learn defines the
JSON; AG-UI and MCP define how it moves. This is the smallest of the three
documents on purpose — most interaction never leaves the client.

## The two-tier interaction rule *(normative, Prototype)*

- **Local tier** — clicks, drags, reveals, in-game moves resolve entirely in
  the renderer at zero latency and zero tokens. They are never events.
- **Event tier** — pedagogy-changing moments reach the agent: a result was
  produced, help was requested, an author steered. Only these payloads
  exist in this format.

A conforming host MUST NOT forward local-tier interaction to a model by
default; chatty surfaces would otherwise be a cost and privacy hazard.

## Payloads *(Planned; the debate-ai and writing-workshop widgets ship
working precedents of the loop today)*

```json
{ "type": "widget_result",
  "surfaceId": "…", "componentId": "quiz-1",
  "result": { "status": "complete", "correct": false, "score": null, "attempts": 1 } }

{ "type": "action",
  "surfaceId": "…", "componentId": "help-button",
  "name": "help_requested", "context": { "step": 3 } }

{ "type": "author_edit",
  "surfaceId": "…", "componentId": "intro-text",
  "op": "set_text", "payload": { "text": "…" } }
```

`widget_result` carries the same `WidgetResult` contract the surface's data
model uses ([`surface.md`](./surface.md)) — one shape from interaction to
data model to event to report. A `widget_result` with `correct: false` is
the canonical remediation trigger: the agent answers on the same stream
with a `surfaceUpdate` adding a gated remediation section.

## Binding 1 — AG-UI *(Prototype)*

Native hosts run activities over an AG-UI event stream. Downstream, surfaces
and progress ride standard events (`RUN_STARTED`, `CUSTOM` carrying
surface messages, `STATE_DELTA` for data-model patches, `RUN_FINISHED`).
Upstream, a2learn payloads post to the host's run endpoint and appear to
the agent as structured input — never as prompt text.

## Binding 2 — MCP Apps *(partially Shipped)*

Chat-embedded activities run in MCP Apps iframes and report through the
`ui/*` channel:

- `ui/update-model-context` — silent context: results the agent should know
  without a visible turn *(Shipped for three widgets)*.
- UI-initiated messages — events that should *trigger* an agent turn
  (help requests).
- Host-proxied tool calls — consent-gated in third-party hosts.

The host owns the policy map from payload type → conversation behavior
(silent context · visible turn · tool call). A first-party host may add
richer channels (identity, first-party telemetry); the payloads stay
identical.

## Untrusted-content rule *(normative)*

Event payloads and surface context can contain learner-authored text. Hosts
MUST label it as untrusted content when it enters a model context — it is
data about the learner, never instructions to the agent.
