import type { FlashcardSpec, MarkdownCardSpec } from '@/lib/pathway/schema';

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
 * Coverage is deliberately incremental and honestly labeled:
 * `A2UI_SUPPORTED_KINDS` names what maps today. The first two kinds are the
 * *reading* shapes — mapping loses no interaction because the basic catalog
 * can express them fully. Interactive kinds (drag-sort, draft-meter …) need
 * either A2UI's function/template machinery or an a2learn catalog extension;
 * they join this list one verifiable fixture at a time, never by claim.
 */

/** The standard catalog every surface here targets. */
export const A2UI_BASIC_CATALOG = 'https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json';

export const A2UI_SUPPORTED_KINDS = ['markdown-card', 'flashcard'] as const;

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

function completedAction(kind: string) {
  return {
    event: {
      name: 'a2learn.widget_completed',
      userMessage: 'Finished the activity.',
      context: { kind, correct: true },
    },
  };
}

/**
 * markdown-card: title, markdown body, optional tip, a done button. The
 * basic catalog's `Text` accepts simple Markdown, so the reading surface
 * maps without loss.
 */
function markdownCardSurface(spec: MarkdownCardSpec, surfaceId: string): A2UISurfaceMessage {
  const components: A2UIComponent[] = [
    { id: 'root', component: 'Card', child: 'layout' },
    {
      id: 'layout',
      component: 'Column',
      children: ['title', 'body', ...(spec.tip ? ['tip'] : []), 'done'],
    },
    { id: 'title', component: 'Text', text: `**${spec.title}**` },
    { id: 'body', component: 'Text', text: spec.body },
    ...(spec.tip
      ? [{ id: 'tip', component: 'Text', text: `Tip: ${spec.tip}`, variant: 'caption' } as A2UIComponent]
      : []),
    { id: 'done', component: 'Button', variant: 'primary', child: 'done-label', action: completedAction(spec.kind) },
    { id: 'done-label', component: 'Text', text: 'Got it' },
  ];

  return {
    version: 'v1.0',
    createSurface: {
      surfaceId,
      catalogId: A2UI_BASIC_CATALOG,
      components,
      dataModel: { a2learn: { kind: spec.kind } },
    },
  };
}

/**
 * flashcard: the prompt, then each card as front/back stacked in a Card.
 * Static children rather than a template: both sides visible is the honest
 * degradation the basic catalog supports — tap-to-flip needs local state
 * the standard catalog does not model, and arrives with an a2learn catalog
 * extension rather than a pretend mapping.
 */
function flashcardSurface(spec: FlashcardSpec, surfaceId: string): A2UISurfaceMessage {
  const sideText = (side: FlashcardSpec['cards'][number]['front']): string =>
    [side.text, side.markdown].filter(Boolean).join('\n\n') || '—';

  const cardComponents: A2UIComponent[] = spec.cards.flatMap((card, i) => [
    { id: `card-${i}`, component: 'Card', child: `card-${i}-col` },
    { id: `card-${i}-col`, component: 'Column', children: [`card-${i}-front`, `card-${i}-divider`, `card-${i}-back`] },
    { id: `card-${i}-front`, component: 'Text', text: `**${sideText(card.front)}**` },
    { id: `card-${i}-divider`, component: 'Divider' },
    { id: `card-${i}-back`, component: 'Text', text: sideText(card.back) },
  ]);

  const components: A2UIComponent[] = [
    { id: 'root', component: 'Column', children: ['prompt', ...spec.cards.map((_, i) => `card-${i}`), 'done'] },
    { id: 'prompt', component: 'Text', text: spec.prompt },
    ...cardComponents,
    { id: 'done', component: 'Button', variant: 'primary', child: 'done-label', action: completedAction(spec.kind) },
    { id: 'done-label', component: 'Text', text: 'Done' },
  ];

  return {
    version: 'v1.0',
    createSurface: {
      surfaceId,
      catalogId: A2UI_BASIC_CATALOG,
      components,
      dataModel: { a2learn: { kind: spec.kind } },
    },
  };
}

/** Null for kinds not yet mapped — callers state the gap rather than guess. */
export function toA2UISurface(spec: unknown, surfaceId: string): A2UISurfaceMessage | null {
  const kind = (spec as { kind?: string })?.kind;
  if (kind === 'markdown-card') return markdownCardSurface(spec as MarkdownCardSpec, surfaceId);
  if (kind === 'flashcard') return flashcardSurface(spec as FlashcardSpec, surfaceId);
  return null;
}
