# The widget registry

The registry is the project's core extension API. Every activity the server
can produce — for the MCP tools, the pathway planner, the teacher previews,
and the student walkthrough — comes from one registry of **capabilities that
manufacture activities on demand**, not a shelf of authored files.

Everything in this page is defined in
[`src/lib/widgets/types.ts`](../src/lib/widgets/types.ts).

## Two registries, deliberately

Each activity kind registers into two maps, from two different files:

| Registry | Entry type | Runs | Registered by |
|---|---|---|---|
| Catalog | `WidgetCatalogEntry` | client + server | `src/lib/widgets/definitions/<kind>.ts` |
| Generators | `WidgetGenerator` | server only | `src/lib/widgets/definitions/<kind>.generate.ts` |

The split is not stylistic. A single definition bundling the React component
and the model call would drag the AI SDK into the browser bundle — static
import graphs don't care that `generate` is never *called* client-side; the
module defining it still gets pulled in. So the client-facing renderer
(`components/widgets/registry.tsx`) imports only the catalog, and only
`pathway/generate.ts` imports the generators.

Registration is a side effect of importing the definition module. Two barrel
files own the imports:

- `src/lib/widgets/builtins.ts` — catalog entries (client-safe)
- `src/lib/widgets/builtins.generate.ts` — generators (server-only)

## `WidgetCatalogEntry`

```ts
interface WidgetCatalogEntry<Spec> {
  kind: WidgetKind;
  schema: ZodType<Spec>;
  component: ComponentType<{ spec: Spec; onComplete?: (...args: any[]) => void }>;
  plannerDescription: string;
  assesses: boolean;
  coverageRule?: (standard: StandardRef) => boolean;
}
```

- **`schema`** — the Zod schema the model's output must validate against.
  This is the security model in miniature: the model fills a schema; it never
  emits code. `.describe()` calls on fields double as prompt text.
- **`component`** — the human-written renderer, registered as a lazy import
  so a kind's code loads only when it renders. `onComplete` signatures
  genuinely differ per kind (payload-free, `(correct: boolean)`,
  `(results: CardResult[])`), which is why the prop is loosely typed here and
  strictly typed inside each definition module.
- **`plannerDescription`** — one sentence of prose fed to the pathway
  planner so it knows when to reach for this kind.
- **`assesses`** — whether finishing this activity records if the student
  was actually right. Required, not defaulted: a "check" step built on a
  non-assessing kind would report mastery nothing measured. This flag is what
  the [evidence contract](./evidence.md) keys on.
- **`coverageRule`** — an optional predicate narrowing which standards the
  kind fits (a fraction area model only fits fraction standards). Omitted
  means it fits everything.

## `WidgetGenerator`

```ts
interface WidgetGenerator {
  kind: WidgetKind;
  generate(ctx: WidgetGenerationContext): Promise<{ widget: WidgetSpec | null; note: string | null }>;
}
```

`WidgetGenerationContext` carries the verified standard (`anchor`), the plan,
the current step, and a prebuilt prompt fragment with the standard's
decomposition, outcomes, and misconceptions. A generator does the model call
and normalization in one step:

- returning `widget: null` means "this kind couldn't produce something
  usable here" — the orchestrator falls back to `fallbackWidgetKind()`
  (swiper-flashcard by default, settable via `configureFallback`), and the
  fallback's spec is honestly a *different kind's* spec;
- `note` carries any graceful-degradation message shown to the teacher.

## Who reads the registry

One entry serves every consumer — that's the point:

- **The planner** joins every `plannerDescription` + `coverageRule` into its
  widget guidance when composing a pathway.
- **`buildWidget`** (behind both `/api/widget` and the MCP `show_widget`
  tool) resolves a kind, runs its generator against a verified standard, and
  validates the result against `schema`.
- **The renderer** (`components/widgets/registry.tsx`) looks up `component`
  by `kind` — in the walkthrough, teacher previews, and the MCP widget shell.
- **The walkthrough** derives completion semantics: kinds with their own
  continue button advance themselves; kinds with no unambiguous done moment
  get an always-enabled external button with the reason stated.
- **Discovery** (`find_activity`, pre-merge) ranks listings straight from
  catalog metadata — the registry *is* the inventory.

## Adding a kind

The complete recipe with code samples is in
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-widget); the shape of it:

1. **Spec** — a Zod object in `src/lib/pathway/schema.ts`, added to the
   `widgetSpec` union and `widgetKind` enum.
2. **Component** — `src/components/widgets/YourWidget.tsx`, props
   `{ spec, onComplete? }`, emitting `answer_checked` / `widget_completed`
   telemetry if the kind assesses.
3. **Catalog entry** — `src/lib/widgets/definitions/your-widget.ts` calling
   `registerWidgetCatalog`, plus its import line in `builtins.ts`.
4. **Generator** — `definitions/your-widget.generate.ts` calling
   `registerWidgetGenerator`, plus its import line in `builtins.generate.ts`.

Nothing in the pipeline, planner, previews, or MCP surface needs to learn the
new kind exists.

## Known limitation

`widgetSpec` and `widgetKind` in `pathway/schema.ts` are still
hand-maintained alongside the registry. Deriving them from the registry would
close a circular import between `schema.ts` and the registry module; until
that's untangled, adding a kind touches those two unions plus the four files
above.
