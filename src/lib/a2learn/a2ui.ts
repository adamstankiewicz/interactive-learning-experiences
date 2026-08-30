import type { FlashcardSpec, MarkdownCardSpec, StepRevealSpec, WidgetKind } from '@/lib/pathway/schema';

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
 * the conformance suite requires a fixture per supported kind. The mapped
 * kinds are the reading shapes. Known fidelity limits, stated rather than
 * papered over: flashcard's flip becomes front/back Tabs — the reveal
 * survives as renderer-local tab switching, the animation does not — and
 * the catalog's `Text` scopes itself to simple Markdown without HTML,
 * links, or images, so a body leaning on those loses them in any
 * spec-faithful renderer.
 * Full mechanics for every kind is the a2learn catalog's job (#98), not
 * this projection's. The durable home for this mapping is an optional field on the
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
 * The completion action a surface's done button dispatches. None of the
 * mapped kinds assess (`assesses: false` on every one's registry entry), so the context
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
    // Tabs, not a flat stack: the basic catalog cannot express a flip
    // animation, but tab switching is renderer-local, so front/back stays a
    // deliberate reveal instead of both sides lying in the open.
    cardComponents.push(
      { id: `card-${i}`, component: 'Card', child: `card-${i}-tabs` },
      {
        id: `card-${i}-tabs`,
        component: 'Tabs',
        tabs: [
          { title: 'Front', child: `card-${i}-front-col` },
          { title: 'Back', child: `card-${i}-back-col` },
        ],
      },
      { id: `card-${i}-front-col`, component: 'Column', children: front.ids },
      { id: `card-${i}-back-col`, component: 'Column', children: back.ids },
      ...front.components,
      ...back.components,
    );
  });

  const components: A2UIComponent[] = [
    { id: 'root', component: 'Column', children: ['prompt', 'deck', 'done', 'success'] },
    { id: 'prompt', component: 'Text', text: spec.prompt },
    // A horizontal List is the catalog's word for a deck: renderers page or
    // scroll it, so cards present one at a time instead of as a wall.
    { id: 'deck', component: 'List', direction: 'horizontal', children: cardIds },
    ...cardComponents,
    ...doneButton(spec.kind, 'Done'),
    // The author wrote this for the end of the deck; a static surface shows
    // it as a caption rather than dropping it.
    { id: 'success', component: 'Text', text: `When you're done: ${spec.successMessage}`, variant: 'caption' },
  ];

  return surface(surfaceId, spec.kind, components);
}

function stepRevealSurface(spec: StepRevealSpec, surfaceId: string): A2UISurfaceMessage {
  // The reveal survives as navigation, not as gating: Tabs let a reader walk
  // the steps in order or jump around, where the native widget enforces
  // one-at-a-time disclosure. Sequence stays visible in the tab titles; the
  // discipline does not survive projection, and that's stated, not hidden.
  const tabs = spec.steps.map((step, i) => ({ title: step.title, child: `step-${i}-col` }));
  const stepComponents: A2UIComponent[] = spec.steps.flatMap((step, i) => {
    const children = [`step-${i}-body`];
    const parts: A2UIComponent[] = [{ id: `step-${i}-body`, component: 'Text', text: step.body }];
    if (step.why) {
      children.push(`step-${i}-why`);
      parts.push({ id: `step-${i}-why`, component: 'Text', text: `Why: ${step.why}`, variant: 'caption' });
    }
    parts.push({ id: `step-${i}-col`, component: 'Column', children });
    return parts;
  });

  const components: A2UIComponent[] = [
    { id: 'root', component: 'Column', children: ['prompt', 'steps-card', 'done'] },
    { id: 'prompt', component: 'Text', text: spec.prompt },
    { id: 'steps-card', component: 'Card', child: 'steps' },
    { id: 'steps', component: 'Tabs', tabs },
    ...stepComponents,
    ...doneButton(spec.kind, 'Done'),
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
  'step-reveal': stepRevealSurface,
};

export const A2UI_SUPPORTED_KINDS = Object.keys(MAPPERS) as WidgetKind[];

/** Null for kinds not yet mapped — callers state the gap rather than guess. */
export function toA2UISurface(spec: unknown, surfaceId: string): A2UISurfaceMessage | null {
  const kind = (spec as { kind?: string })?.kind as WidgetKind | undefined;
  const mapper = kind ? MAPPERS[kind] : undefined;
  return mapper ? mapper(spec as never, surfaceId) : null;
}
