import { narratedCardSpec, type NarratedCardSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_STEPS = 2;

function normalize(spec: NarratedCardSpec): NarratedCardSpec | null {
  const steps = spec.steps
    .filter((s, i, all) => s.id.trim() && all.findIndex((x) => x.id === s.id) === i)
    .filter((s) => s.title.trim() && s.body.trim())
    .slice(0, 6);

  if (steps.length < MIN_STEPS) return null;
  return { ...spec, steps };
}

registerWidgetGenerator({
  kind: 'narrated-card',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: narratedCardSpec,
      system: [
        'You write a narrated walkthrough that will be read aloud by the browser sentence by sentence.',
        'Give 3–5 steps. Keep body text concise — short, complete sentences that sound natural spoken',
        'aloud. Avoid markdown formatting in the body (no bold, no lists) since it will be read as',
        'plain text. Each step title is a short spoken label (e.g. "Step one: set up the equation").',
        'The optional "why" callout appears visually after the body is spoken; it can use bold.',
        'Ids are short, stable, lowercase slugs.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
    return {
      widget: fallback.widget,
      note: [
        "The narrated card didn't produce enough valid steps — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
