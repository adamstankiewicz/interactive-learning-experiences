import { findTheFlawSpec, type FindTheFlawSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_STEPS = 4;
const MIN_WHY_OPTIONS = 3;

/**
 * The two things that make this widget wrong rather than merely imperfect: a
 * flawed step that isn't in the list, and a "why" stage with no single right
 * answer. Both are unfixable here without inventing content, so they fall back
 * rather than render an unanswerable task.
 */
function normalize(spec: FindTheFlawSpec): FindTheFlawSpec | null {
  const steps = spec.steps
    .filter((s, i, all) => s.id.trim() && all.findIndex((x) => x.id === s.id) === i)
    .slice(0, 6);

  if (steps.length < MIN_STEPS) return null;
  if (!steps.some((s) => s.id === spec.flawedStepId)) return null;

  const whyOptions = spec.whyOptions
    .filter((o, i, all) => o.id.trim() && all.findIndex((x) => x.id === o.id) === i)
    .slice(0, 4);

  if (whyOptions.length < MIN_WHY_OPTIONS) return null;
  if (whyOptions.filter((o) => o.correct).length !== 1) return null;

  return { ...spec, steps, whyOptions };
}

registerWidgetGenerator({
  kind: 'find-the-flaw',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: findTheFlawSpec,
      system: [
        'You write a worked example that contains exactly one mistake, for a student to find and diagnose.',
        '',
        'The work can be anything the standard implies: a solved problem, an experiment someone ran,',
        'an argument someone made, an explanation of why something happened. Attribute it to a',
        'student or an unnamed someone — never to the reader.',
        '',
        'The single hardest requirement, and the one that ruins this activity when broken: every',
        'step except one must be genuinely, checkably correct. A second error, even a small or',
        'stylistic one, makes the task unanswerable — the student finds a real mistake and is told',
        'they are wrong. Re-read your steps and verify each one before you finish.',
        '',
        'The mistake itself must be a real error, not a stylistic choice, not a step that is merely',
        'less elegant. It should be one a student plausibly makes — take it from the known',
        'misconceptions for this standard where one fits. It must be visible in the step as written,',
        'without needing outside knowledge the student has not been given.',
        '',
        'The whyOptions are the diagnosis. Exactly one is correct. The wrong ones are misdiagnoses a',
        'student might genuinely reach — naming the wrong step, describing a real feature of the work',
        'that is not the error, or a plausible-sounding rule that does not apply. Never filler nobody',
        'would pick, and never so close to the right answer that both are defensible.',
        '',
        'The hint points at what to re-check ("check whether each step follows from the one before")',
        'without naming the step or the error. The explanation, shown only once they have it right,',
        'says what is wrong and what should have happened instead.',
      ].join('\n'),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    return {
      widget: null,
      note: "The worked example didn't come out with a single findable mistake — built a fallback activity for this step instead.",
    };
  },
});
