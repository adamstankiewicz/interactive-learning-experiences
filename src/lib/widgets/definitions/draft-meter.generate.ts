import { draftMeterSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

/**
 * The standard's wording is copied into the spec verbatim rather than
 * regenerated: the scoring call needs the graph's text, not a paraphrase.
 *
 * The interesting part of this generator is `checks`. The meter no longer
 * assumes an argument — it asks whatever this standard asks — so the model's
 * real job here is reading the standard and naming the three things a good
 * short response to it would do. Get that wrong and the meter measures the
 * wrong thing confidently, which is worse than not firing at all.
 */
registerWidgetGenerator({
  kind: 'draft-meter',
  async generate(ctx) {
    const needsPassage = ctx.anchor.standard.tags.includes('text-dependent');

    const mode = needsPassage
      ? [
          'This standard is about a TEXT, so the widget supplies a source passage the student reads',
          'before answering. Write it yourself: 40-120 words, age-appropriate, rich enough that there',
          'is something real to say about it, and give it a plausible short attribution. For a',
          'literature standard write a passage with implication under the surface; for history, a',
          'primary-source excerpt with a point of view; for an argument standard, a short piece with a',
          'position worth testing.',
          'The question must be answerable ONLY from that passage.',
          'One check should usually be ESSENTIAL — reading the passage correctly — because a fluent',
          'misreading is not a nearly-good answer.',
        ]
      : [
          'This standard does not depend on a supplied text, so set passage to null.',
          'The question must be answerable in three to five sentences by a student at this grade with',
          'no source material in front of them, and must have real substance to it — a question with',
          'one obvious answer produces nothing to measure.',
          "Prefer something in a student's own life over an abstract civic topic.",
          'Usually no check is ESSENTIAL here: an opinion cannot be factually wrong.',
        ];

    const spec = await generateStructured({
      schema: draftMeterSpec,
      system: [
        'You configure a Draft Meter: a question, a textbox, and one line that scores the strength',
        'of what the student writes.',
        ...mode,
        '',
        'The checks ARE the rubric — read the standard and name the three things a good short',
        'response to THIS standard does. Do not default to claim/reason/evidence unless the standard',
        'is genuinely about argument. A comprehension standard wants an interpretation, support from',
        'the text, and reading it correctly. A history standard wants a claim, evidence from the',
        'source, and context. A summary standard wants the main idea, the key details, and leaving',
        'out the rest. Each label must read naturally inside the sentence',
        '"That\'s all three — X, Y, and Z."',
        '',
        'standardForStudents IS shown to the student behind a "?", so it must name what counts as',
        'done in plain words — the point is that they can see the goalposts, not just be measured',
        'against them. It should agree with the checks you chose.',
      ].join(' '),
      prompt: [
        ctx.prompt,
        '',
        'Copy standardCode and standardDescription from the standard above exactly as given.',
      ].join('\n'),
    });

    // The mode is the pipeline's call, not the model's — a passage on a
    // standard that isn't about a text would change the task the standard asks
    // for. Checks are capped at four so the finish-line sentence stays a
    // sentence, and an all-essential rubric is refused: if everything is
    // essential then a single slip caps the score, which is the harshness this
    // meter was tuned away from.
    const checks = spec.checks.slice(0, 4);
    const essentialCount = checks.filter((c) => c.essential).length;

    return {
      widget: {
        ...spec,
        passage: needsPassage ? spec.passage : null,
        checks:
          essentialCount > 1
            ? checks.map((c, i) => ({ ...c, essential: c.essential && i === checks.findIndex((x) => x.essential) }))
            : checks,
      },
      note: null,
    };
  },
});
