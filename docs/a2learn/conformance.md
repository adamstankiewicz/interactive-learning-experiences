# a2learn conformance — draft v0

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and
**MAY** are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119). Statements without
these keywords are informative.

Nothing conforms to "a2learn" in general; implementations conform to one or
more **conformance classes**. This is what makes conformance claimable and
eventually testable.

## Classes

### Producer

Emits surfaces and/or manifests — a generation pipeline, an authoring tool,
an exporter.

- MUST emit surfaces whose base shape is valid A2UI (flat component list,
  id references) and whose learning semantics live only in the namespaced
  `a2learn` member.
- MUST NOT emit executable code in any surface or manifest.
- MUST ensure referential integrity before publishing: every `children`,
  `bindTo`, and gate path names an id that exists.
- MUST NOT mark a standards claim `verified: true` unless the code resolved
  against the named source.
- SHOULD keep authoring-side generation shapes flat (see README design
  principles); the wire shape is what this spec governs.

### Renderer

Consumes surfaces and presents them to a learner.

- MUST resolve `component` names only against a catalog under its control;
  unknown names MUST degrade to a visible notice, never code execution or a
  crash.
- MUST validate props against the catalog entry before rendering.
- MUST ignore unknown members of the `a2learn` extension (render the
  surface as if they were absent) and MUST NOT fail on them.
- MUST apply surface updates by id-merge; a renderer MAY reject an update
  whose `version` it does not support.
- SHOULD render partial component lists progressively during streaming.
- MUST implement the local/event interaction tiers per
  [`events.md`](./events.md): local-tier interaction MUST NOT be forwarded
  to a model by default.

### Registry

Indexes manifests and answers discovery queries.

- MUST NOT present unverified standards claims as verified, in query
  results or listings.
- MUST NOT serve `tier: "code"` listings through a content-tier channel;
  code-tier distribution requires the curated path (signed publishers,
  review).
- MUST preserve manifest fields it does not understand (round-tripping),
  and MUST record — not grant — reviewer attestations.
- SHOULD rank or filter on `verified`, `a11y`, and `reviewed` so consuming
  agents can express trust requirements.
- MUST NOT include learner data in manifests or query responses; a registry
  indexes content, never people.

### Host

Runs the event bindings between an activity and an agent (a native app, an
MCP Apps host, a first-party embedded client).

- MUST deliver event-tier payloads to the agent side as structured data,
  never by interpolating them into prompt text as instructions.
- MUST label learner-authored text entering a model context as untrusted
  content.
- MUST own an explicit policy map from payload type to conversation
  behavior (silent context · visible turn · tool call) and SHOULD apply
  rate limits so a chatty surface cannot storm a model.
- MAY extend the binding with richer channels (identity, telemetry); the
  payload shapes MUST remain as specified.

## Versioning

Surfaces and manifests carry an integer `version` / `a2learn` field.
During v0, breaking changes are allowed and are recorded in
[`CHANGELOG.md`](./CHANGELOG.md); implementations SHOULD pin to the version
they were built against and MUST NOT silently reinterpret a document with a
higher version.

## Extension rule

Third parties MAY add fields under their own namespace prefix (`x-` or a
reverse-DNS key). Producers and registries MUST preserve such fields;
renderers MUST ignore the ones they do not understand. The `a2learn`
namespace itself is reserved for this specification.

## Path to 1.0

v1.0 is gated on: at least **two independent implementations** of the
Renderer class, machine-readable schemas plus a conformance fixture suite,
and a window of **two months without breaking changes**. The spec
formalizes what implementations ship — a requirement no implementation
exercises is a candidate for removal before 1.0, not a reason to build.
