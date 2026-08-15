import { debateAiSpec, type DebateAiSpec } from '@/lib/pathway/schema';
import { generateStructured } from '@/lib/structured';
import { fallbackWidgetKind, getWidgetGenerator, registerWidgetGenerator } from '@/lib/widgets/types';

const MIN_MOVES = 3;
const MAX_MOVES = 4;

/**
 * A debate with nothing to evaluate is not a debate. Two failure modes are
 * unfixable here without inventing content — too few moves to track, or a turn
 * limit that ends the exchange before it starts — so they fall back rather than
 * render an activity that cannot do its job.
 */
function normalize(spec: DebateAiSpec): DebateAiSpec | null {
  const moves = spec.moves
    .filter((m, i, all) => m.id.trim() && all.findIndex((x) => x.id === m.id) === i)
    .slice(0, MAX_MOVES);

  if (moves.length < MIN_MOVES) return null;

  const turnLimit = Math.min(6, Math.max(4, Math.round(spec.turnLimit)));
  return { ...spec, moves, turnLimit };
}

registerWidgetGenerator({
  kind: 'debate-ai',
  async generate(ctx) {
    const spec = await generateStructured({
      schema: debateAiSpec,
      system: [
        'You configure a short debate in which an assistant argues one side of a contestable claim',
        'and a student tests it. What is being practised is evaluation — judging an argument on its',
        'merits — so everything here serves that.',
        '',
        'The motion must have a real second side. A claim every reasonable person already accepts',
        'gives the student nothing to evaluate, and one with an obvious right answer turns the',
        'exercise into correcting the assistant. Pick something the standard makes arguable.',
        '',
        'The persona is the most important field and the easiest to write badly. The assistant has to',
        'be PLAUSIBLE BUT FLAWED: name the specific ways it argues weakly, so a student has something',
        'findable to catch. Real statistics used for claims they do not quite support, a correlation',
        'treated as a cause, one vivid anecdote standing in for a pattern, a term that quietly shifts',
        'meaning halfway through. Never "argues badly" in the abstract, and never flawless — a',
        'watertight opponent is not an exercise.',
        '',
        'The moves are what the student gets credit for. Write them in the student\'s own language,',
        'because they are shown on screen before the debate starts — this is how a student learns',
        'what evaluating even looks like. One of them must be conceding a fair point: a debate that',
        'only rewards attack teaches students never to grant anything, which is the opposite of',
        'judgement.',
        '',
        'Keep the whole thing age-appropriate for the grade band, and pick a motion a school would be',
        'comfortable staging. Contestable is the point; inflammatory is not.',
      ].join('\n'),
      prompt: ctx.prompt,
    });

    const widget = normalize(spec);
    if (widget) return { widget, note: null };

    const fallback = await getWidgetGenerator(fallbackWidgetKind())!.generate(ctx);
    return {
      widget: fallback.widget,
      note: [
        "This standard didn't yield a claim with a genuine second side — built a fallback activity for this step instead.",
        fallback.note,
      ]
        .filter(Boolean)
        .join(' '),
    };
  },
});
