import { stepRevealSpec, type StepRevealSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_STEPS = 2;

function normalize(spec: StepRevealSpec): StepRevealSpec | null {
  const steps = spec.steps
    .filter((s, i, all) => s.id.trim() && all.findIndex((x) => x.id === s.id) === i)
    .filter((s) => s.title.trim() && s.body.trim())
    .slice(0, 6);

  if (steps.length < MIN_STEPS) return null;
  return { ...spec, steps };
}

registerWidgetGenerator({
  kind: 'step-reveal',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: stepRevealSpec,
      system: [
        'You write a step-by-step walkthrough of a concept or worked example.',
        'Give 3–5 steps. Each step has a short title (e.g. "Step 1: Isolate the variable")',
        'and a body that explains that step clearly in markdown — use bold for key terms,',
        'avoid headings. The optional "why" field is one sentence explaining the reasoning',
        'behind this step; include it when the reasoning is non-obvious.',
        'Steps must build on each other so that reading them in order tells a complete story.',
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
        "The step-reveal didn't produce enough valid steps — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
