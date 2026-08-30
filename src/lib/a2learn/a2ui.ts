import type { FlashcardSpec, MarkdownCardSpec, WidgetKind } from '@/lib/pathway/schema';

import { A2LEARN_EVENT_PREFIX } from '@/lib/a2learn/manifest';

/**
 * The boundary mapper: a widget spec, expressed as a Google A2UI v1.0
 * `createSurface` message against the standard `basic` catalog.
 *
 * This is where the industry-standard claim becomes checkable: every surface
 * this module emits validates against the vendored upstream schemas in
 * `spec/a2ui/v1_0/` (`pnpm conformance`, enforced in CI). The app's own wire
 * format stays the flat authoring schema; A2UI is produced here, at the
 * boundary, per the a2learn format's alignment rule.
 *
 * Coverage is deliberately incremental and honestly labeled: a kind is
 * supported when it has an entry in `MAPPERS` below — `A2UI_SUPPORTED_KINDS`
 * is derived from that map, so the list and the dispatch cannot drift, and
 * the conformance suite requires a fixture per supported kind. The first two
 * kinds are the reading shapes. Known fidelity limits, stated rather than
 * papered over: flashcard's tap-to-flip is degraded to front/back stacked
 * (the basic catalog models no local state — an a2learn catalog extension
 * will), and a markdown body using links or tables renders them as literal
 * Markdown in strict renderers (the catalog's `Text` scopes itself to simple
 * Markdown). The durable home for this mapping is an optional field on the
 * widget registry entry — tracked with the registry-owned-semantics
 * refactor — so adding a kind stays one file.
 */

/** The standard catalog every surface here targets. */
export const A2UI_BASIC_CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

export type A2UIComponent = { id: string; component: string } & Record<string, unknown>;

export type A2UISurfaceMessage = {
  version: 'v1.0';
  createSurface: {
    surfaceId: string;
    catalogId: string;
    components: A2UIComponent[];
    dataModel?: Record<string, unknown>;
  };
};

/**
 * The completion action a surface's done button dispatches. Neither mapped
 * kind assesses (`assesses: false` on both registry entries), so the context
 * deliberately carries no `correct` claim — completion is not mastery, and
 * an A2UI consumer must not be told otherwise. When an assessing kind joins
 * this file, its action gains a verdict from real checking, gated on the
 * registry's `assesses` flag — never asserted by the mapper.
 */
function completedAction(kind: WidgetKind) {
  return {
    event: {
      name: `${A2LEARN_EVENT_PREFIX}widget_completed`,
      userMessage: 'Finished the activity.',
      context: { kind },
    },
  };
}

/** The shared envelope, so a catalog or version change lands in one place. */
function surface(surfaceId: string, kind: WidgetKind, components: A2UIComponent[]): A2UISurfaceMessage {
  return {
    version: 'v1.0',
    createSurface: {
      surfaceId,
      catalogId: A2UI_BASIC_CATALOG,
      components,
      dataModel: { a2learn: { kind } },
    },
  };
}

function doneButton(kind: WidgetKind, label: string): A2UIComponent[] {
  return [
    { id: 'done', component: 'Button', variant: 'primary', child: 'done-label', action: completedAction(kind) },
    { id: 'done-label', component: 'Text', text: label },
  ];
}

/**
 * One flashcard side as components: text and/or markdown as `Text`, an image
 * as `Image` with its alt text — an image-only side is a legal spec per the
 * schema and must not degrade to a placeholder dash. Content is emitted
 * verbatim in separate components, never joined or wrapped in emphasis
 * markers (bold cannot span the blank line a join introduces).
 */
function sideComponents(
  prefix: string,
  side: FlashcardSpec['cards'][number]['front'],
): { ids: string[]; components: A2UIComponent[] } {
  const components: A2UIComponent[] = [];
  if (side.text) components.push({ id: `${prefix}-text`, component: 'Text', text: side.text });
  if (side.markdown) components.push({ id: `${prefix}-md`, component: 'Text', text: side.markdown });
  if (side.imageUrl) {
    components.push({
      id: `${prefix}-image`,
      component: 'Image',
      url: side.imageUrl,
      description: side.imageAlt ?? '',
      fit: 'contain',
    });
  }
  if (components.length === 0) {
    components.push({ id: `${prefix}-empty`, component: 'Text', text: '—', variant: 'caption' });
  }
  return { ids: components.map((c) => c.id), components };
}

function markdownCardSurface(spec: MarkdownCardSpec, surfaceId: string): A2UISurfaceMessage {
  const components: A2UIComponent[] = [
    { id: 'root', component: 'Card', child: 'layout' },
    {
      id: 'layout',
      component: 'Column',
      children: ['title', 'body', ...(spec.tip ? ['tip'] : []), 'done'],
    },
    // Title verbatim — no added emphasis markers, which break when the
    // model's own text already contains Markdown syntax.
    { id: 'title', component: 'Text', text: spec.title },
    { id: 'body', component: 'Text', text: spec.body },
    ...(spec.tip
      ? [{ id: 'tip', component: 'Text', text: `Tip: ${spec.tip}`, variant: 'caption' } as A2UIComponent]
      : []),
    ...doneButton(spec.kind, 'Got it'),
  ];

  return surface(surfaceId, spec.kind, components);
}

function flashcardSurface(spec: FlashcardSpec, surfaceId: string): A2UISurfaceMessage {
  const cardComponents: A2UIComponent[] = [];
  const cardIds: string[] = [];

  spec.cards.forEach((card, i) => {
    const front = sideComponents(`card-${i}-front`, card.front);
    const back = sideComponents(`card-${i}-back`, card.back);
    cardIds.push(`card-${i}`);
    cardComponents.push(
      { id: `card-${i}`, component: 'Card', child: `card-${i}-col` },
      {
        id: `card-${i}-col`,
        component: 'Column',
        children: [...front.ids, `card-${i}-divider`, ...back.ids],
      },
      ...front.components,
      { id: `card-${i}-divider`, component: 'Divider' },
      ...back.components,
    );
  });

  const components: A2UIComponent[] = [
    { id: 'root', component: 'Column', children: ['prompt', ...cardIds, 'done', 'success'] },
    { id: 'prompt', component: 'Text', text: spec.prompt },
    ...cardComponents,
    ...doneButton(spec.kind, 'Done'),
    // The author wrote this for the end of the deck; a static surface shows
    // it as a caption rather than dropping it.
    { id: 'success', component: 'Text', text: `When you're done: ${spec.successMessage}`, variant: 'caption' },
  ];

  return surface(surfaceId, spec.kind, components);
}

/**
 * The dispatch table IS the support list — `A2UI_SUPPORTED_KINDS` derives
 * from it, so claiming a kind without mapping it (or vice versa) is
 * impossible by construction.
 */
const MAPPERS: Partial<Record<WidgetKind, (spec: never, surfaceId: string) => A2UISurfaceMessage>> = {
  'markdown-card': markdownCardSurface,
  flashcard: flashcardSurface,
};

export const A2UI_SUPPORTED_KINDS = Object.keys(MAPPERS) as WidgetKind[];

/** Null for kinds not yet mapped — callers state the gap rather than guess. */
export function toA2UISurface(spec: unknown, surfaceId: string): A2UISurfaceMessage | null {
  const kind = (spec as { kind?: string })?.kind as WidgetKind | undefined;
  const mapper = kind ? MAPPERS[kind] : undefined;
  return mapper ? mapper(spec as never, surfaceId) : null;
}
