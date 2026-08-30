# Vendored A2UI v1.0 schemas

Copied verbatim from [google/A2UI](https://github.com/google/A2UI)
(`specification/v1_0`, upstream commit `abcff1515fad`, Apache-2.0):

- `agent_to_renderer.json` — the message envelope (`createSurface`,
  `updateComponents`, `updateDataModel`, …)
- `common_types.json` — component envelope, actions, data binding
- `catalogs/basic/catalog.json` — the standard component catalog (Text,
  Card, Column, Button, …)

These are the conformance target for `src/lib/a2learn/a2ui.ts`: every
surface the boundary mapper emits is validated against these exact schemas
by `pnpm conformance` (and CI). Update by re-copying from upstream and
recording the new commit here — never by editing in place.
