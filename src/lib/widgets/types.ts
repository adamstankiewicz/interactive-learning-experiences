import type { ComponentType } from 'react';
import type { ZodType } from 'zod';

import type { Anchor } from '@/lib/pathway/events';
import type { PathwayPlan, WidgetKind, WidgetSpec } from '@/lib/pathway/schema';
import type { StandardRef } from '@/lib/standards/types';

/**
 * The open widget registry — the extension point the "closed 3-file union"
 * used to be. Adding a widget now means one new file under `definitions/`
 * plus one import line in `builtins.ts`; nothing here, `pathway/schema.ts`,
 * `pathway/generate.ts`, or `components/widgets/registry.tsx` needs editing
 * to add a kind (`schema.ts`'s `widgetSpec`/`widgetKind` union stays static
 * for now — deriving it from the registry too is a real follow-up, not done
 * here, since it risks a circular import between schema.ts and this module
 * that isn't worth the hackathon-time gamble to untangle right now).
 *
 * Split into two registries, not one, for a real reason caught by actually
 * building this: a single `WidgetDefinition` bundling `component` (client)
 * and `generate` (server, imports the AI SDK) together means any client
 * component importing the registry for rendering drags the AI SDK into the
 * browser bundle along with it — confirmed by grepping the built `.next`
 * client chunks and finding `generateStructured` sitting in one. Static
 * import graphs don't care that `generate` is never *called* client-side;
 * the module that defines it is still pulled in. So `WidgetCatalogEntry`
 * (client-safe: schema, component, coverageRule, plannerDescription) and
 * `WidgetGenerator` (server-only: the actual model call) are registered
 * separately, by separate files, imported by separate `builtins` modules —
 * `components/widgets/registry.tsx` only ever touches the catalog.
 */

export type WidgetGenerationContext = {
  anchor: Anchor;
  plan: PathwayPlan;
  step: PathwayPlan['steps'][number];
  /** Prebuilt shared prompt context — standard, components, outcomes, misconceptions, this step. */
  prompt: string;
};

export interface WidgetCatalogEntry<Spec = unknown> {
  kind: WidgetKind;
  schema: ZodType<Spec>;
  // Each widget component's onComplete signature genuinely differs (payload-free,
  // (correct: boolean), (results: CardResult[])) — `any[]` here is deliberate,
  // not laziness: the registry is heterogeneous by nature, and each definition
  // module still gets full type-checking against its own concrete component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<{ spec: Spec; onComplete?: (...args: any[]) => void }>;
  /** Short prose fed into the planner's widgetKind guidance — see `builtins.ts` for how these join. */
  plannerDescription: string;
  /** Omitted = fits every standard (crossword, swiper-flashcard today). */
  coverageRule?: (standard: StandardRef) => boolean;
}

export interface WidgetGenerator {
  kind: WidgetKind;
  /**
   * Does the model call, normalization, and any graceful-degradation note in
   * one step — a null `widget` means "this widget's own generation failed
   * to produce something usable," which the orchestrator in `generate.ts`
   * resolves by falling back to `fallbackWidgetKind()`.
   *
   * Returns the full `WidgetSpec` union, not just this kind's own spec type —
   * a fallback call genuinely returns a *different* kind's spec (e.g.
   * drag-sort falling back to swiper-flashcard).
   */
  generate(ctx: WidgetGenerationContext): Promise<{ widget: WidgetSpec | null; note: string | null }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const catalog = new Map<string, WidgetCatalogEntry<any>>();
const generators = new Map<string, WidgetGenerator>();
let fallback = 'swiper-flashcard';

/** Client-safe: schema, component, coverageRule, plannerDescription. Import from a `.ts` file with no AI SDK import. */
export function registerWidgetCatalog<Spec>(entry: WidgetCatalogEntry<Spec>): void {
  catalog.set(entry.kind, entry);
}

export function getWidgetCatalogEntry(kind: string): WidgetCatalogEntry<unknown> | undefined {
  return catalog.get(kind);
}

export function listWidgetCatalogEntries(): WidgetCatalogEntry<unknown>[] {
  return [...catalog.values()];
}

/** Server-only: the actual model call. Only ever imported by `pathway/generate.ts`. */
export function registerWidgetGenerator(generator: WidgetGenerator): void {
  generators.set(generator.kind, generator);
}

export function getWidgetGenerator(kind: string): WidgetGenerator | undefined {
  return generators.get(kind);
}

/** The kind every other kind's own normalization falls back to when it can't produce something usable. */
export function configureFallback(kind: string): void {
  fallback = kind;
}

export function fallbackWidgetKind(): string {
  return fallback;
}
