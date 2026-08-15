import { draftMeterSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { registerWidgetGenerator } from '@/lib/widgets/types';

// The standard's wording is copied into the spec verbatim rather than regenerated:
// the scoring call needs the graph's text, not a paraphrase. Two modes, decided by
// the standard's tags rather than by the model.
registerWidgetGenerator({
  kind: 'draft-meter',
  async generate(ctx) {
    const needsPassage = ctx.anchor.standard.tags.includes('reading-evidence');

    const mode = needsPassage
      ? [
          'This is a READING standard, so the widget supplies a source passage the student reads',
          'before answering. Write it yourself: 40-120 words, age-appropriate, with a real position',
          'or tension in it worth disagreeing about, and give it a plausible short attribution.',
          'The question must be answerable ONLY from that passage — it asks the student to take a',
          'position about the text and back it with something the passage actually says.',
        ]
      : [
          'This is a WRITING standard, so set passage to null.',
          'The question must be answerable in three to five sentences by a middle schooler with no',
          'source material in front of them, and must have a real second side — a question with one',
          'obvious answer produces no argument to measure.',
          "Prefer something in a student's own life over an abstract civic topic.",
        ];

    const spec = await generateStructured({
      schema: draftMeterSpec,
      system: [
        'You configure a Draft Meter: a question, a textbox, and one line that scores the strength',
        'of what the student writes.',
        ...mode,
        'The criteria name what a strong answer contains; they ground the scorer and are never shown.',
        'standardForStudents IS shown to the student behind a "?", so it must name what counts as',
        'done in plain words — the point is that they can see the goalposts, not just be measured',
        'against them.',
      ].join(' '),
      prompt: [ctx.prompt, '', 'Copy standardCode and standardDescription from the standard above exactly as given.'].join(
        '\n',
      ),
    });

    // The mode is the pipeline's call, not the model's — a passage on a writing
    // standard would change the task the standard actually asks for.
    return {
      widget: { ...spec, criteria: spec.criteria.slice(0, 4), passage: needsPassage ? spec.passage : null },
      note: null,
    };
  },
});
