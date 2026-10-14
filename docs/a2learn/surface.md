# a2learn-surface — draft v0

An **activity surface** is what a learner sees and touches: a declarative,
renderable description resolved against a host's component catalog. An
a2learn surface is **valid A2UI** — flat component list, id references,
shared data model — plus learning semantics carried in a namespaced
extension member, so any A2UI renderer displays the surface and simply
ignores what it does not understand.

## Base shape *(Prototype)*

```json
{
  "version": 0,
  "root": "root-stack",
  "components": [
    {
      "id": "root-stack",
      "component": "Stack",
      "props": { "direction": "column", "gap": "lg" },
      "children": ["intro-card", "game", "score"]
    },
    {
      "id": "game",
      "component": "GameBoard",
      "props": { "boardSize": "3x3", "gameMode": "solo-clear", "questions": ["…"] }
    },
    {
      "id": "score",
      "component": "Counter",
      "props": { "counterLabel": "Clouds collected" },
      "bindTo": "game"
    }
  ],
  "dataModel": {},
  "a2learn": { "lang": "en", "theme": { "hue": 210, "name": "Cloud Factory Floor" } }
}
```

- `components` is a **flat list with id references**, never a nested tree —
  partial lists stream progressively and are always renderable.
- `component` names resolve against the rendering host's **catalog**. The
  catalog is the trust boundary: props are validated against the entry's
  schema, unknown names degrade to a visible notice, and no surface can
  introduce code.
- Updates are **merge-by-id** (`surfaceUpdate` semantics from A2UI): partial
  component lists merge over the current surface; there is deliberately no
  operation-based patch DSL.

## State: reference, not expression *(Prototype)*

Every stateful component **writes one value keyed by its own id** into the
shared data model. Anything reactive names that id in a plain string:

- `bindTo: "game"` — read another component's value (a Counter bound to a
  GameBoard is a live scoreboard).
- `visibleWhen: { "path": "quiz-1.correct", "equals": true }` — gate a
  component on another's state. This is the entire progression mechanism.

Generating agents never author expressions, computed bindings, or pointer
syntax — a reference graph of strings is both safer and dramatically more
reliable to generate.

## The result contract *(Planned)*

Stateful learning components write a `WidgetResult` shape so completion and
correctness mean the same thing across every component, catalog, and host:

```json
{ "status": "complete", "correct": true, "score": 400, "attempts": 2 }
```

This single convention is what connects surfaces to sequencing (gates read
it), reporting (snapshots aggregate it), and the event vocabulary
([`events.md`](./events.md) carries it to agents).

## Learning extensions (`a2learn` member)

- `lang` *(Planned)* — BCP-47 language of the content; may also appear
  per-component for mixed-language activities.
- `theme` *(Prototype)* — a single hue (0–360) plus an in-world name; the
  renderer derives a full palette at fixed lightness/chroma so any
  model-chosen hue keeps contrast. Agents author intent, never raw colors.
- `sequence` *(Planned)* — for multi-activity artifacts (pathways): ordered
  activity references with gating rules over `WidgetResult` state. This is
  the layer no existing UI spec carries — see `manifest.md` for how
  sequences are listed.

## Accessibility ground rules *(Planned)*

Composed surfaces must maintain heading order and landmarks, honor reduced
motion, and announce injected content (e.g. remediation arriving
mid-session) via live regions. Interaction accessibility (keyboard,
focus, ARIA state) is a property of catalog components, not of surfaces —
hosts certify their catalogs; surfaces cannot break what the catalog
guarantees.
