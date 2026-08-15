# Contributing

## Getting set up

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

One LLM API key is enough to run everything. Set `STANDARDS_SOURCE=example` and leave
Supabase unconfigured and you need no other accounts — see the README.

Before opening a PR:

```bash
pnpm lint     # eslint
pnpm build    # next build — this is also the typecheck
```

CI runs both on every PR. `pnpm build` matters as much as lint: it typechecks, and the
editor language server does not catch everything the compiler does.

## Adding a widget

A widget is **data, not a React tree** — the model emits a spec and a registry renders it.
Nothing in the pipeline needs to know your kind exists.

Take `drag-sort` as the smallest complete example: it has a spec, a component, a catalog
entry, a generator, and a demo page, and nothing else references it.

### 1. The spec — `src/lib/pathway/schema.ts`

```ts
export const yourWidgetSpec = z.object({
  kind: z.literal('your-widget'),
  learningComponentId: z.string().nullable(),
  // …the fields the model fills in. Use .describe() generously; it is prompt text.
});
export type YourWidgetSpec = z.infer<typeof yourWidgetSpec>;
```

Then add it in **two** places in the same file:

- the `widgetSpec` discriminated union
- the `widgetKind` enum

Both are still hand-maintained. Deriving them from the registry would close a circular
import between `schema.ts` and the registry, which is why it hasn't been done.

### 2. The component — `src/components/widgets/YourWidget.tsx`

Props are `{ spec, onComplete? }`. If a student can be right or wrong, emit telemetry:

```ts
const telemetry = useWidgetTelemetry();

telemetry.track({
  eventType: 'answer_checked',
  widgetKind: spec.kind,
  learningComponentId: spec.learningComponentId,
  standardCode: telemetry.standardCode,
  correct: allCorrect,
  payload: { attempt: attempts + 1, ...(allCorrect ? {} : { misconception: spec.hint }) },
});
```

and `widget_completed` once on success, guarded by a ref so a re-submit can't double-count.
This is what feeds session reports and the personalization that weights later pathways
toward what a student found hard. A widget that skips it records nothing.

### 3. The catalog entry — `src/lib/widgets/definitions/your-widget.ts`

```ts
registerWidgetCatalog<YourWidgetSpec>({
  kind: 'your-widget',
  schema: yourWidgetSpec,
  component: lazy(() =>
    import('@/components/widgets/YourWidget').then((m) => ({ default: m.YourWidget })),
  ),
  plannerDescription: 'What it does, which subjects it suits, and which step purposes it fits.',
  assesses: true,
  coverageRule: (standard) => standard.tags.includes('your-tag'),
});
```

Then add one import line to `builtins.ts`.

- **`plannerDescription` is prompt text.** It is joined with every other widget's and becomes
  the menu the planner chooses from. Say what the widget is for *and* when not to use it —
  the good ones name a step purpose ("prefer practice or check, never activate").
- **`assesses`** is whether finishing the widget records whether the student was *right*. It
  is required, so you have to decide. `false` is correct for presentational widgets; it also
  means the widget can't back a `check` step, and one that tries is substituted with a note.
- **`coverageRule`** is optional. Omit it and the widget fits every standard.

⚠️ **This file must not import the AI SDK, directly or transitively.** It is imported by a
client component, so anything it pulls in ships to the browser. That's the whole reason the
generator lives in a separate file.

### 4. The generator — `src/lib/widgets/definitions/your-widget.generate.ts`

```ts
registerWidgetGenerator({
  kind: 'your-widget',
  async generate(ctx) {
    // ctx: { anchor, plan, step, prompt } — `prompt` is the prebuilt shared context
    // Return { widget: null, note } if you can't produce something usable; the
    // orchestrator falls back for you.
  },
});
```

Then add one import line to `builtins.generate.ts`. This is the server-only half.

### 5. A demo page — `src/app/demo/your-widget/page.tsx`

Every widget has one, with a hand-written spec so it renders without a model call. It is how
reviewers see your widget without spending a token.

### Two easily-missed steps

- **`SELF_ADVANCING_KINDS`** in `src/components/pathway/PathwayWalkthrough.tsx` — add your
  kind if finishing it is unambiguous. Leave it out and the student gets an explicit "I'm
  done" button, which is right for anything open-ended.
- **`pnpm mcp:build`** regenerates `public/widget-shell.html`, a committed bundle that inlines
  every widget for MCP hosts. It does not regenerate itself, and it has been forgotten before.

## Adding a standards source

Implement `StandardsSource` (`src/lib/standards/types.ts`) and add it to the `REGISTRY` map in
`index.ts`. `src/lib/standards/example.ts` is a complete in-memory implementation to copy.
`STANDARDS_SOURCE` accepts a comma-separated list tried in priority order, so a new source can
cover topics an existing one rejects.

## Adding a storage adapter

Implement the interface in `src/lib/storage/types.ts` and register it in `index.ts`.
`memory.ts` is the reference implementation.

## Conventions

- Comments explain *why*, not *what*. The existing code is a good guide.
- Prefer a registry entry over a `switch`. If you find yourself adding a case for your kind
  somewhere, that list probably wants to be derived instead.
- Don't commit `package.json` or `pnpm-lock.yaml` changes unless the PR is about dependencies.
