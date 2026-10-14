# a2learn-manifest — draft v0

The **manifest** is an activity's listing: the metadata that lets an *agent*
— a tutor bot, a lesson planner, a chat assistant — discover the right
activity at runtime and decide whether to invoke it. It is the registry/
marketplace's native format, and the most original part of a2learn: UI specs
describe how activities render; nothing else describes what they *teach*,
in machine-checkable terms.

All of this section is **Planned** unless noted; the field vocabulary is
drawn from contracts that ship today (the widget registry's
`assesses`/`completion`/coverage metadata *(Shipped)* and the standards
verification pipeline *(Shipped)*).

## Example

```json
{
  "a2learn": 0,
  "id": "cloud-factory-floor",
  "kind": "activity",
  "title": "Cloud Factory Floor",
  "summary": "A solo-clear board game: claim every station on the factory floor by answering water-cycle questions.",
  "tier": "content",

  "standards": [
    { "code": "5-ESS2-1", "source": "learning-commons", "verified": true }
  ],
  "audience": [{ "scheme": "k12-us", "values": ["4", "5", "6"] }],

  "pedagogy": {
    "assesses": true,
    "completion": "signal",
    "mechanics": ["game-board", "single-choice"],
    "purposes": ["practice", "check"]
  },

  "delivery": {
    "surface": "https://…/activities/cloud-factory-floor/surface.json",
    "mcp": { "server": "https://…/api/mcp", "tool": "show_activity" },
    "catalogRequires": ["GameBoard", "Counter", "Stack", "Card"]
  },

  "lang": ["en"],
  "a11y": { "keyboard": true, "reducedMotion": true, "screenReader": "partial" },

  "provenance": {
    "publisher": "…",
    "license": "CC-BY-4.0",
    "generated": true,
    "reviewed": []
  }
}
```

## Field groups

- **Identity** — `id`, `kind` (`activity` | `pathway` — a pathway manifest
  lists an ordered `sequence` of activity references with gating rules),
  `title`, `summary`, `tier`.
- **Alignment** — `standards[]` with `source` and `verified`. Verification
  means the code resolved against a real standards graph (the reference
  implementation verifies against Learning Commons). Unverified claims are
  legal but rank differently; an index MUST NOT present them as verified.
  Who the activity is *for* is `audience`, specified below — separately,
  because alignment and audience answer different questions and not every
  standards graph carries both.
- **Pedagogy** — `assesses` (does completing it measure correctness — a
  "check" step may only use assessing activities), `completion`
  (`internal-cta` | `signal` | `none`), `mechanics`, `purposes`
  (`activate` | `model` | `practice` | `check`) — an open vocabulary, not a
  closed enum: a consumer MUST ignore a purpose it does not recognize rather
  than reject the listing.
- **Delivery** — where the surface lives and how to invoke it. An activity
  is invokable if the consuming host can satisfy `catalogRequires` (native
  rendering) *or* via the listed MCP server (zero-catalog rendering in any
  MCP Apps host).
- **Access** — `lang` (BCP-47), `a11y` declarations. Declarations, not
  certifications; a trust layer (below) can attest them.
- **Provenance** — publisher, license, whether content was AI-generated,
  and `reviewed[]`: attestations by named reviewers/organizations. The
  trust layer is *structurally* part of the manifest but *institutionally*
  separate — a registry records attestations; it does not grant them.

## Audience *(normative)*

`audience` names who an activity is for, as scheme-scoped labels:

```json
"audience": [{ "scheme": "k12-us", "values": ["4", "5", "6"] }]
```

A bare label cannot carry this on its own — `"4"` is grade 4 in one
education system and year 4 or level 4 in another — so the naming authority
travels with the value, exactly as `standards[]` carries `source` alongside
`code`.

- A producer MUST emit `scheme` on every entry, and MUST NOT emit values for
  a scheme it does not own.
- A consumer MUST treat an unrecognized `scheme` as opaque: filter on it,
  never parse it. A listing whose every entry is unrecognized is still valid.
- An activity MAY carry several entries when it genuinely serves more than
  one audience.
- `audience` MAY be absent. Absent means *unstated*, not *universal*; a
  consumer MUST NOT read a missing `audience` as "suitable for anyone".

One scheme is registered in v0:

| Scheme | Values | Meaning |
| --- | --- | --- |
| `k12-us` | `"K"`, `"1"`–`"12"` | US K-12 grade levels |

Higher education, professional and workplace training are structurally
supported and deliberately unregistered: this format documents what a
producer emits today, and none emits them yet. They join under the
[extension rule](./conformance.md#extension-rule) until one does.

## Two tiers *(normative)*

- `tier: "content"` — the activity is pure data rendered by a host's
  existing catalog. Open publication.
- `tier: "code"` — the listing introduces new catalog components
  (executable). Curated channel only: signed publishers and review gates.
  A registry MUST NOT serve code-tier listings as if they were content-tier.

## Discovery *(sketch)*

The query surface is deliberately specified as MCP tools rather than a new
API style — e.g. `find_activity({ standard, audience, mechanics, lang,
assesses })` returning ranked manifests. The reference implementation's
existing `show_widget(standardCode, kind)` *(Shipped)* is the invocation
half; `find_activity` over a manifest index is the MVP of the discovery
half.
