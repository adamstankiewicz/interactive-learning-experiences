<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in this repo

This project expects agents as contributors and maintainers, not just
assistants. Everything below is written so a competent agent can land a
correct change without a human walking it through — and so the gates, not
vibes, decide whether a change merges.

## What this is

The open activity server for teaching agents: verified interactive practice
out, evidence of what the student did back. One Next.js process serves an
MCP endpoint (`/api/mcp`), REST mirrors, and a reference teacher/student
app. The product is the loop: assign a standards-verified activity → the
student works → structured evidence returns to whatever assigned it.

## The four seams (extend here, not elsewhere)

| Seam | Where | Extend by |
|---|---|---|
| Widget registry | `src/lib/widgets/types.ts` | one definition file + one import line — see CONTRIBUTING.md "Adding a widget" |
| Standards source | `src/lib/standards/types.ts` | implement the interface; copy `example.ts`; select with `STANDARDS_SOURCE` |
| Storage adapter | `src/lib/storage/types.ts` | implement the interface; select with `STORAGE_ADAPTER` (default: auto — Supabase if configured, else memory) |
| Protocol facades | `src/app/api/mcp`, `/api/widget` | logic never lives in a facade; add transports, don't fork business logic |

## Invariants that fail review

1. **The model never writes code that runs.** Generated output fills Zod
   schemas rendered by human-written components. Never eval, never render
   model-emitted markup outside the schema path.
2. **Student identity never reaches this server from an integration.**
   Anonymous ids only on the wire. Educator identity may someday reach the
   edge; student identity never does.
3. **No verdicts for unmeasured work.** `correct: null` for anything
   without a real check; a widget kind must declare `assesses` (a "check"
   step on a non-assessing kind reports mastery nothing measured).
4. **Honesty over polish.** Degraded runs say so ("exploration pathway",
   "not saved — <reason>"); errors name the problem; docs never describe
   unmerged features as shipped without saying so.
5. **Contract changes need an issue first.** Anything a third party
   programs against (widget spec schemas, catalog entry shape, API routes,
   persisted formats, the evidence contract) — see GOVERNANCE.md.

## Verify before you push

```bash
rm -rf .next && npx tsc --noEmit   # stale .next causes phantom type errors after branch switches
pnpm lint                          # lint src/mcp/scripts explicitly if stale local worktrees pollute the default glob
pnpm test                          # vitest (once the test-foundation PR lands)
pnpm conformance                   # A2UI surfaces vs vendored Google schemas (once conformance lands)
pnpm build                         # next build; also typechecks; needs no secrets
pnpm mcp:build                     # REQUIRED after any change reachable from widget components:
                                   # the committed public/widget-shell.html goes stale silently,
                                   # and stale = widgets break in every MCP host. CI diffs it.
```

## What needs a test — and which kind

The PR template's "a test that fails without this PR" box is load-bearing:
in an agent-maintained repo, gates are the contract, and untested logic is
a gate with a hole in it. Match the instrument to the code:

- **Pure or deterministic logic** (scoring, collectors, state machines,
  strip/aggregate helpers): vitest, colocated as `*.test.ts`. If review
  finds a behavior bug in logic like this, the fix ships with the test
  that would have caught it.
- **Wire and format surfaces** (protocol envelopes, emitted documents):
  pin the contract — real `Request`s against the route for the envelope;
  golden files validated against vendored upstream schemas for formats
  (`pnpm conformance` is the house pattern), always with negative
  controls so a vacuously-green validator can't hide.
- **Model-call quality** (generation, scoring accuracy): never unit
  tests — that's the eval harness (planned; Braintrust-local). Don't
  fake it with snapshot tests of model output.
- **UI components**: lowest priority today; behavior worth guarding
  usually lives in an extractable pure helper — extract and test that
  instead.

`vitest` stubs Next's `server-only` marker (see `vitest.config.mts`);
tests must run offline — use the keyless `example` standards source
(`STANDARDS_SOURCE=example`) instead of mocking verification.

## Gotchas that cost real time

- **`widgetSpec`/`widgetKind` in `src/lib/pathway/schema.ts` are
  hand-maintained** alongside the registry (circular-import constraint). A
  registry test guards the drift; adding a kind touches both.
- **Completion semantics live in `PathwayWalkthrough.tsx`**
  (`HAS_OWN_CTA`/`ALWAYS_ENABLED` sets) until the registry-owned-semantics
  refactor lands — a new kind with its own continue button must be added
  there or its UX silently breaks.
- **The catalog/generator split is load-bearing**: catalog entries
  (client-safe) and generators (server-only, AI SDK) register from separate
  files. Importing a generator from client-reachable code drags the AI SDK
  into the browser bundle.
- **Local storage default**: with Supabase env vars present the adapter
  auto-selects Supabase. On shared dev machines another project's local
  Supabase may own the default ports — set `STORAGE_ADAPTER=memory` unless
  you know the database is this project's.

## Conventions

- Sentence case for all UI copy. Semantic state always ships icon + word,
  never color alone.
- Comments explain why, not what. No metadata comments.
- Don't touch `package.json`/`pnpm-lock.yaml` unless the PR is about
  dependencies. Toolchain majors (TypeScript, ESLint) are deliberate
  standalone PRs, not drive-by bumps.
- Commit messages state what changed and why it's safe; PR bodies state
  what a reviewer should scrutinize and what was deliberately deferred.
- DCO: by submitting you certify you have the right to contribute under
  Apache-2.0 (see GOVERNANCE.md).

## Where the docs live

`docs/` (once the landing-and-docs PR lands): the registry API reference is
the centerpiece; `docs/messaging.md` governs how the project describes
itself — claims there are load-bearing, don't invent new ones. The a2learn
format draft lives under `docs/a2learn/`; A2UI conformance fixtures under
`spec/a2learn/fixtures/` with vendored upstream schemas in `spec/a2ui/`.
