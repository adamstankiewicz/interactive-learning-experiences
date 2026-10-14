# a2learn format changelog

Breaking changes are allowed throughout v0 and are recorded here. Entries
say what changed *and what an implementer must do about it*.

## v0 draft — 2026-08-30

**`manifest.gradeBand` → `manifest.audience` (breaking).** The old field was
a `{min, max}` integer range, which can only express K-12 grade levels: an
undergraduate year or a new-hire cohort has no honest representation in it.
`audience` is a list of scheme-scoped label sets, carrying the naming
authority with the value the way `standards[]` already carries `source`
alongside `code`.

*What an implementer must do:* replace `gradeBand: { min, max }` with an
`audience` entry under scheme `k12-us`, values as strings (`"K"`, `"1"`–
`"12"`). A consumer filtering on grade moves from range comparison to label
matching within a recognized scheme, and MUST treat an unrecognized scheme
as opaque rather than parsing it. No producer outside this repository emits
`gradeBand`, so no migration window is provided.

**`manifest.pedagogy.purposes` is an open vocabulary**, stated normatively:
a consumer ignores a purpose it does not recognize rather than rejecting the
listing. Not breaking for the four existing values.

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
