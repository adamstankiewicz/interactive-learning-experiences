# a2learn — draft v0 (experimental)

**a2learn** ("agent-to-learning") is a specification for **agent-generated,
agent-discoverable interactive learning activities**. It defines *data*, not
wire behavior: what a learning activity **is** (its surface), how it is
**described for discovery** (its manifest), and what its **interactions
report** (its events). Transport, rendering, and distribution are borrowed
from specifications that already exist and already have hosts:

| Layer | Provided by | a2learn's relationship |
| --- | --- | --- |
| Surface description | [A2UI](https://a2ui.org) | a2learn-surface is a *profile*: valid A2UI plus namespaced learning extensions |
| Agent ↔ UI transport | [AG-UI](https://github.com/ag-ui-protocol/ag-ui) | a2learn payloads ride AG-UI events unchanged |
| Distribution into chat hosts | [MCP Apps](https://modelcontextprotocol.io) | activities are invokable MCP tools; surfaces render in MCP Apps iframes |

This is a deliberate scope choice: **a2learn is a spec, not a protocol.** New
protocols require every host to implement wire behavior; formats spread by
emit-and-validate. The one part with protocol flavor — the event vocabulary —
is specified as payload shapes with *bindings* to AG-UI and MCP, never as a
new wire protocol.

## The documents

1. [`surface.md`](./surface.md) — the activity itself: an A2UI-conformant
   surface carrying learning semantics (state contract, gating, language).
2. [`manifest.md`](./manifest.md) — the listing: standards-verified,
   pedagogy-aware discovery metadata an agent can query at runtime. This is
   the registry/marketplace's format.
3. [`events.md`](./events.md) — what interactions report: result and action
   payloads, with two transport bindings.
4. [`conformance.md`](./conformance.md) — conformance classes (Producer,
   Renderer, Registry, Host), versioning and extension rules, and the gate
   for 1.0.
5. [`considerations.md`](./considerations.md) — security, privacy
   (education records, minors), and accessibility considerations.
6. [`CHANGELOG.md`](./CHANGELOG.md) — every breaking change, with what an
   implementer must do about it.

## Conventions

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and
**MAY** are to be interpreted per RFC 2119; text without them is
informative. Conformance is always claimed against a class in
[`conformance.md`](./conformance.md), never against "a2learn" in general.

## Design principles

- **Data, never code.** An activity is renderable data resolved against a
  host's component catalog. Model output never ships executable logic; the
  trust boundary is the catalog. (Marketplace corollary: activity *instances*
  are open data; new component *kinds* are code and travel a separate,
  curated channel.)
- **Generation-shaped.** Structured output reliably fails on nested unions
  and wide flat objects. The spec's wire shapes may be rich; *authoring*
  representations stay flat, with mapping at the boundary. References are
  plain strings (`bindTo`), never expression languages.
- **Standards-anchored, verifiably.** Manifest alignment claims name their
  source and verification status. Unverified claims are representable but
  distinguishable — an index can rank on it.
- **Degrade gracefully.** A plain A2UI renderer that ignores every a2learn
  extension still renders a usable surface. Extensions add semantics; they
  must not be load-bearing for basic rendering.

## Status

Draft v0, reference-implementation-led: this repository is the reference
implementation, and the spec documents what ships (or is explicitly marked
**Planned**). Breaking changes are allowed and changelogged throughout 0.x.
The spec formalizes reality, never aspiration — see the format-strategy
lesson: implementation first (Jupyter, glTF, Markdown), spec-first is how
formats fragment (QTI).

Each section is tagged with an implementation status:

- **Shipped** — on `main`, exercised by the app.
- **Prototype** — working in the composition prototype (`/demo/ag-ui-compose`
  lineage), not yet in the core product path.
- **Planned** — designed, not yet built; most likely to change.
