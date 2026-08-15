import { writingWorkshopSpec, type WritingWorkshopSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_DIMENSIONS = 3;
const MAX_DIMENSIONS = 4;

/**
 * Two things make this widget unusable rather than merely imperfect: nothing to
 * mark against, and a target length that turns an extended piece into a short
 * answer draft-meter should have taken instead.
 */
function normalize(spec: WritingWorkshopSpec): WritingWorkshopSpec | null {
  const lookFor = spec.lookFor
    .filter((d, i, all) => d.id.trim() && all.findIndex((x) => x.id === d.id) === i)
    .slice(0, MAX_DIMENSIONS);

  if (lookFor.length < MIN_DIMENSIONS) return null;

  const targetWords = Math.min(600, Math.max(150, Math.round(spec.targetWords)));
  return { ...spec, lookFor, targetWords };
}

registerWidgetGenerator({
  kind: 'writing-workshop',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: writingWorkshopSpec,
      system: [
        'You set a long-form writing assignment that a student will draft and then ask to have',
        'marked up.',
        '',
        'Choose the genre the standard actually implies, and say which it is: an argument essay, a',
        'lab report, a research proposal, a short story, a historical explanation. This is not',
        'decoration — the reviewer reads it to know which standards to apply, and a lab report judged',
        'as an essay gets marked down for the things that make it a lab report.',
        '',
        'The brief has to be startable. A student staring at an empty box needs the question, who it',
        'is for, and roughly how long — not a topic. "Write about ecosystems" is not a brief; "Write',
        'a proposal for an investigation into what affects how fast an ice cube melts, for your',
        'teacher to approve" is.',
        '',
        'The dimensions are what gets underlined. Draw them from the standard and the genre together,',
        'and make each one something a reader can point at in a sentence — "evidence", "method",',
        '"voice", "structure". Avoid anything that can only be judged from the whole piece at once,',
        'because a note that cannot attach to a passage has nowhere to sit.',
        '',
        'Keep the target length honest for the grade: enough that the piece has a shape, short enough',
        'to finish in a lesson.',
      ].join('\n'),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
    return {
      widget: fallback.widget,
      note: [
        "This standard didn't yield an extended piece worth marking up — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
