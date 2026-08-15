import { dragSortSpec, type DragSortSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_ITEMS = 4;

/**
 * The student's order is compared against `correctOrder` position for
 * position, so the two lists have to describe the same set. Returns null
 * when too little survives to be a real ordering task.
 */
function normalize(spec: DragSortSpec): DragSortSpec | null {
  const byId = new Map<string, DragSortSpec['items'][number]>();
  for (const item of spec.items) {
    if (item.id.trim() && !byId.has(item.id)) byId.set(item.id, item);
  }

  const order: string[] = [];
  const seen = new Set<string>();
  for (const id of spec.correctOrder) {
    if (byId.has(id) && !seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }

  const kept = order.slice(0, 8);
  if (kept.length < MIN_ITEMS) return null;

  const items = kept.map((id) => byId.get(id));
  if (items.some((item) => !item)) return null;

  return { ...spec, items: items as DragSortSpec['items'], correctOrder: kept };
}

registerWidgetGenerator({
  kind: 'drag-sort',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: dragSortSpec,
      system: [
        'You configure a drag-to-order activity: the student arranges chips into a single',
        'correct sequence.',
        'Give 5 items. The ordering must be genuinely determined by the content — a sequence of',
        'events, steps, magnitudes, or stages — never a matter of taste or style.',
        'Ids are short, stable, lowercase slugs. correctOrder lists every item id exactly once,',
        'in the correct order.',
        'Labels are self-contained: a student must be able to place a chip without having seen',
        'the others, so no label may refer to "the next one" or "the previous step".',
        'The hint names the misconception a wrong ordering reveals rather than giving the answer.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    return {
      widget: null,
      note: "The ordering activity didn't have enough items with a definite position — built a fallback activity for this step instead.",
    };
  },
});
