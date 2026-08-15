import { dragCategorizeSpec, type DragCategorizeSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_ITEMS = 4;

/**
 * An item pointing at an unauthored column can never be placed correctly, so
 * it's dropped, then any column left empty goes with it. Returns null when
 * fewer than two columns survive — no sorting decision is left.
 */
function normalize(spec: DragCategorizeSpec): DragCategorizeSpec | null {
  const categories = spec.categories
    .filter((category, index, all) => category.id.trim() && all.findIndex((c) => c.id === category.id) === index)
    .slice(0, 4);

  const categoryIds = new Set(categories.map((category) => category.id));
  const items = spec.items
    .filter((item, index, all) => item.id.trim() && all.findIndex((i) => i.id === item.id) === index)
    .filter((item) => categoryIds.has(item.categoryId))
    .slice(0, 10);

  const used = new Set(items.map((item) => item.categoryId));
  const keptCategories = categories.filter((category) => used.has(category.id));

  if (keptCategories.length < 2 || items.length < MIN_ITEMS) return null;

  return { ...spec, categories: keptCategories, items };
}

registerWidgetGenerator({
  kind: 'drag-categorize',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: dragCategorizeSpec,
      system: [
        'You configure a drag-to-sort activity: the student drops each chip into the column it',
        'belongs to.',
        'Give 3 categories and 6 items spread across them, with at least one item per category.',
        'Each item belongs in exactly one category, and categoryId must match one of the',
        'category ids you defined. Ids are short, stable, lowercase slugs.',
        'The categories are the distinction the standard actually turns on, and the items are',
        'chosen so that the borderline ones separate students who hold a listed misconception',
        'from students who do not.',
        'The hint names that misconception rather than giving the answer.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
    return {
      widget: fallback.widget,
      note: [
        "The sorting activity didn't resolve into at least two filled categories — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
