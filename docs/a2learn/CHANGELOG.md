# a2learn format changelog

Breaking changes are allowed throughout v0 and are recorded here. Entries
say what changed *and what an implementer must do about it*.

## v0 draft — 2026-08-21

Initial draft: README (scope: a format riding AG-UI/A2UI/MCP, not a
protocol), `surface.md` (A2UI profile: flat components, `bindTo`
references, `WidgetResult` contract, namespaced `a2learn` extensions),
`manifest.md` (discovery/listing format: verified standards alignment,
pedagogy metadata, content/code tiers, provenance + attestations),
`events.md` (payload shapes with AG-UI and MCP Apps bindings; two-tier
interaction rule), `conformance.md` (Producer / Renderer / Registry / Host
classes; versioning and extension rules; the 1.0 gate), and
`considerations.md` (security, privacy, accessibility).

Reference implementation: this repository. Status tags (Shipped /
Prototype / Planned) mark which sections are exercised by running code.
