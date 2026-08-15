import { fractionAreaModelSpec, type FractionAreaModelSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Keep the widget solvable: the target denominator must be among the offered choices. */
function normalize(spec: FractionAreaModelSpec): FractionAreaModelSpec {
  const denominator = clamp(spec.denominator, 2, 12);
  const numerator = clamp(spec.numerator, 1, denominator);

  const choices = [...new Set([...spec.denominatorChoices, denominator])]
    .filter((value) => value >= 2 && value <= 12)
    .sort((a, b) => a - b)
    .slice(0, 6);

  return {
    ...spec,
    denominator,
    numerator,
    denominatorChoices: choices.includes(denominator) ? choices : [...choices, denominator].sort((a, b) => a - b),
  };
}

registerWidgetGenerator({
  kind: 'fraction-area-model',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: fractionAreaModelSpec,
      system: [
        'You configure an interactive fraction area model: the student picks how many equal parts',
        'to partition a whole into, then selects parts to build a target fraction.',
        'Choose a numerator and denominator that make the target learning component visible —',
        'a unit fraction (numerator 1) for partitioning skills, a non-unit fraction for composing.',
        'Keep the denominator inside the grade-level range the standard implies.',
        'The hint names the specific misconception a wrong answer reveals.',
      ].join(' '),
      prompt: ctx.prompt,
    });

    return { widget: normalize(spec), note: null };
  },
});
