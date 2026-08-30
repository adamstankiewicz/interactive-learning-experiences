import type { A2UIComponent, A2UISurfaceMessage } from '@/lib/a2learn/a2ui';
import type { FlashcardSpec, MarkdownCardSpec, StepRevealSpec } from '@/lib/pathway/schema';

import { A2LEARN_CATALOG_DRAFT } from '@/lib/a2learn/catalog';
import { A2LEARN_EVENT_PREFIX } from '@/lib/a2learn/manifest';

/**
 * a2learn interaction primitives, in draft: *generic, parameterized*
 * behavior components — not one primitive per widget kind. A kind-shaped
 * primitive (a "Stepper", a "FlipDeck") just recreates the whole-widget
 * problem at smaller grain; these instead name the behaviors themselves,
 * with policies as data, so that new activity shapes can be *composed at
 * generation time* — by a mapper today, by a planner model tomorrow —
 * without anyone shipping new component code. Invariant 1 holds: what gets
 * generated is a composition tree of declared primitives and basic-catalog
 * content components, schema-validatable; every primitive's implementation
 * is human-written renderer code.
 *
 * The draft set — two words, chosen because today's kinds prove them:
 *
 * - `a2learn:Sequence` — ordered children traversed under a policy:
 *   `order` ('linear' | 'free'), `disclosure` ('gated' | 'all'),
 *   `revealed` ('accumulate' | 'replace'), plus an optional
 *   `completeAction` dispatched when the learner advances past the end.
 *   step-reveal IS Sequence(linear, gated, accumulate); a flashcard deck
 *   IS Sequence(free, all, replace).
 * - `a2learn:Reveal` — one thing with N faces and a tap-to-turn
 *   affordance. A flashcard IS Reveal(front, back).
 *
 * Content inside primitives is ordinary basic-catalog components — the
 * draft catalog is declared as basic ∪ primitives, so a composition reuses
 * every content word the basic tier already has.
 */

export type SequencePolicy = {
  /** May the reader jump around, or only move to what's next? */
  order: 'linear' | 'free';
  /** Is the next item held back until the reader advances? */
  disclosure: 'gated' | 'all';
  /** Do passed items stay visible, or does the next replace them? */
  revealed: 'accumulate' | 'replace';
};

export const SEQUENCE = 'a2learn:Sequence';
export const REVEAL = 'a2learn:Reveal';
/**
 * `a2learn:Callout` — the first *content* primitive: a block whose
 * pedagogical intent is data (`intent`: 'why' | 'tip' | 'note' today,
 * open to more), with a bold `label` and markdown `text`. The native
 * widgets style a "why" and a "tip" as emphasized boxes; without this
 * word that emphasis degrades to a muted caption in every projection.
 */
export const CALLOUT = 'a2learn:Callout';

function completedAction(kind: string) {
  return {
    event: {
      name: `${A2LEARN_EVENT_PREFIX}widget_completed`,
      userMessage: 'Finished the activity.',
      context: { kind },
    },
  };
}

function compositionSurface(surfaceId: string, components: A2UIComponent[]): A2UISurfaceMessage {
  return {
    version: 'v1.0',
    createSurface: { surfaceId, catalogId: A2LEARN_CATALOG_DRAFT, components },
  };
}

function stepRevealComposition(spec: StepRevealSpec, surfaceId: string): A2UISurfaceMessage {
  const itemIds = spec.steps.map((_, i) => `step-${i}`);
  const items: A2UIComponent[] = spec.steps.flatMap((step, i) => {
    const children = [`step-${i}-title`, `step-${i}-body`];
    const parts: A2UIComponent[] = [
      { id: `step-${i}-title`, component: 'Text', text: step.title },
      { id: `step-${i}-body`, component: 'Text', text: step.body },
    ];
    if (step.why) {
      children.push(`step-${i}-why`);
      parts.push({ id: `step-${i}-why`, component: CALLOUT, intent: 'why', label: 'Why?', text: step.why });
    }
    parts.push({ id: `step-${i}`, component: 'Column', children });
    return parts;
  });

  return compositionSurface(surfaceId, [
    { id: 'root', component: 'Column', children: ['prompt', 'walk'] },
    { id: 'prompt', component: 'Text', text: spec.prompt },
    {
      id: 'walk',
      component: SEQUENCE,
      policy: { order: 'linear', disclosure: 'gated', revealed: 'accumulate' } satisfies SequencePolicy,
      children: itemIds,
      completeAction: completedAction(spec.kind),
    },
    ...items,
  ]);
}

function markdownCardComposition(spec: MarkdownCardSpec, surfaceId: string): A2UISurfaceMessage {
  const children = ['title', 'body', ...(spec.tip ? ['tip'] : [])];
  return compositionSurface(surfaceId, [
    { id: 'root', component: 'Column', children },
    { id: 'title', component: 'Text', text: spec.title },
    { id: 'body', component: 'Text', text: spec.body },
    ...(spec.tip
      ? [{ id: 'tip', component: CALLOUT, intent: 'tip', label: 'Tip:', text: spec.tip } as A2UIComponent]
      : []),
  ]);
}

function flashcardComposition(spec: FlashcardSpec, surfaceId: string): A2UISurfaceMessage {
  const cardIds = spec.cards.map((_, i) => `card-${i}`);
  const cards: A2UIComponent[] = spec.cards.flatMap((card, i) => {
    const face = (side: typeof card.front, prefix: string): A2UIComponent[] => {
      const parts: A2UIComponent[] = [];
      if (side.text) parts.push({ id: `${prefix}-text`, component: 'Text', text: side.text });
      if (side.markdown) parts.push({ id: `${prefix}-md`, component: 'Text', text: side.markdown });
      if (side.imageUrl) {
        parts.push({
          id: `${prefix}-image`,
          component: 'Image',
          url: side.imageUrl,
          description: side.imageAlt ?? '',
          fit: 'contain',
        });
      }
      return parts;
    };
    const front = face(card.front, `card-${i}-front`);
    const back = face(card.back, `card-${i}-back`);
    return [
      {
        id: `card-${i}`,
        component: REVEAL,
        faces: [
          { title: 'Front', child: `card-${i}-front-col` },
          { title: 'Back', child: `card-${i}-back-col` },
        ],
      },
      { id: `card-${i}-front-col`, component: 'Column', children: front.map((c) => c.id) },
      { id: `card-${i}-back-col`, component: 'Column', children: back.map((c) => c.id) },
      ...front,
      ...back,
    ];
  });

  return compositionSurface(surfaceId, [
    { id: 'root', component: 'Column', children: ['prompt', 'deck'] },
    { id: 'prompt', component: 'Text', text: spec.prompt },
    {
      id: 'deck',
      component: SEQUENCE,
      policy: { order: 'free', disclosure: 'all', revealed: 'replace' } satisfies SequencePolicy,
      children: cardIds,
      completeAction: completedAction(spec.kind),
    },
    ...cards,
  ]);
}

/**
 * Compose a spec from generic primitives, where a composition exists. The
 * point of the exercise: two primitives cover two kinds today, and a third
 * kind needing Sequence(linear, gated, replace) — or any other policy mix —
 * would be pure data, no new code. Returns null for kinds not yet composed;
 * callers fall back and say so.
 */
export function toA2LearnComposition(spec: unknown, surfaceId: string): A2UISurfaceMessage | null {
  if (!spec || typeof spec !== 'object' || !('kind' in spec)) return null;
  switch ((spec as { kind: string }).kind) {
    case 'step-reveal':
      return stepRevealComposition(spec as StepRevealSpec, surfaceId);
    case 'flashcard':
      return flashcardComposition(spec as FlashcardSpec, surfaceId);
    case 'markdown-card':
      return markdownCardComposition(spec as MarkdownCardSpec, surfaceId);
    default:
      return null;
  }
}
